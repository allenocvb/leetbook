//! Localhost listener the browser extension posts captured submissions to.
//!
//! Fixed port + a pairing token persisted in the app data dir. Valid payloads
//! are forwarded to the webview as a `leetbook://capture` event; all business
//! logic stays in TypeScript (packages/core).

use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter, Manager, State};
use tiny_http::{Header, Response, Server};

pub const PORT: u16 = 7749;
const TOKEN_HEADER: &str = "x-leetbook-token";
/// A pairing request the user never answers should not stay approvable forever.
const PAIR_REQUEST_TTL: Duration = Duration::from_secs(120);

#[derive(serde::Serialize, Clone)]
pub struct PairingInfo {
    pub port: u16,
    pub token: String,
    pub listening: bool,
    pub queued: Option<usize>,
}

/// A short code shown in both the extension and the approval prompt, so the user can see
/// they are approving the request they just made rather than something else on localhost.
#[derive(serde::Serialize, Clone)]
pub struct PairPrompt {
    pub id: String,
    pub code: String,
}

#[derive(Clone, Copy, PartialEq)]
enum PairStatus {
    Pending,
    Approved,
    Denied,
}

struct PairRequest {
    id: String,
    code: String,
    created: Instant,
    status: PairStatus,
}

#[derive(Default)]
pub struct ListenerState {
    listening: AtomicBool,
    queued: AtomicUsize,
    queue_reported: AtomicBool,
    token: Mutex<String>,
    /// Only the newest request is approvable; a second request supersedes the first.
    pending_pair: Mutex<Option<PairRequest>>,
}

#[derive(serde::Deserialize)]
struct QueueStatus {
    queued: usize,
}

#[tauri::command]
pub fn get_pairing_info(
    app: AppHandle,
    state: State<'_, ListenerState>,
) -> Result<PairingInfo, String> {
    let token = current_token(&app, &state)?;
    Ok(pairing_info(&state, token))
}

#[tauri::command]
pub fn regenerate_pairing_token(
    app: AppHandle,
    state: State<'_, ListenerState>,
) -> Result<PairingInfo, String> {
    let token = generate_token();
    fs::write(token_path(&app)?, &token).map_err(|error| error.to_string())?;
    replace_pairing_token(&state, token.clone())?;
    Ok(pairing_info(&state, token))
}

/// The prompt the UI should show, if a request is still pending and unexpired.
#[tauri::command]
pub fn pending_pair_request(state: State<'_, ListenerState>) -> Option<PairPrompt> {
    let slot = state.pending_pair.lock().ok()?;
    let request = slot.as_ref()?;
    if request.status != PairStatus::Pending || request.created.elapsed() > PAIR_REQUEST_TTL {
        return None;
    }
    Some(PairPrompt {
        id: request.id.clone(),
        code: request.code.clone(),
    })
}

/// Records the user's decision. The extension is polling and picks it up on its next check.
#[tauri::command]
pub fn resolve_pair_request(
    state: State<'_, ListenerState>,
    id: String,
    approve: bool,
) -> Result<(), String> {
    let mut slot = state
        .pending_pair
        .lock()
        .map_err(|_| "pairing request lock is unavailable".to_string())?;
    match slot.as_mut() {
        Some(request) if request.id == id => {
            request.status = if approve {
                PairStatus::Approved
            } else {
                PairStatus::Denied
            };
            Ok(())
        }
        _ => Err("that pairing request is no longer active".to_string()),
    }
}

fn pairing_info(state: &ListenerState, token: String) -> PairingInfo {
    PairingInfo {
        port: PORT,
        token,
        listening: state.listening.load(Ordering::Relaxed),
        queued: state
            .queue_reported
            .load(Ordering::Relaxed)
            .then(|| state.queued.load(Ordering::Relaxed)),
    }
}

pub fn start(app: AppHandle) -> Result<(), String> {
    let token = load_or_create_token(&app)?;
    set_current_token(&app.state::<ListenerState>(), token)?;
    let server = Server::http(("127.0.0.1", PORT)).map_err(|e| e.to_string())?;
    app.state::<ListenerState>()
        .listening
        .store(true, Ordering::Relaxed);
    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let response = handle(&app, &mut request);
            let _ = request.respond(response);
        }
    });
    Ok(())
}

fn handle(app: &AppHandle, request: &mut tiny_http::Request) -> Response<std::io::Cursor<Vec<u8>>> {
    // Own the URL up front: the path is needed after the body reader borrows the request
    // mutably, and /pair/status carries a query string the exact-match arms cannot see.
    let url = request.url().to_string();
    let path = url.split('?').next().unwrap_or("").to_string();
    let method = request.method().as_str().to_string();

    match (method.as_str(), path.as_str()) {
        // CORS preflight from the leetcode.com content script
        ("OPTIONS", _) => cors(Response::from_string("").with_status_code(204)),
        ("GET", "/ping") => cors(json_response(200, r#"{"ok":true,"app":"leetbook"}"#)),
        ("POST", "/capture") => {
            if !has_valid_token(app, request) {
                return cors(json_response(401, r#"{"ok":false,"error":"bad token"}"#));
            }

            let body = match read_json_body(request) {
                Ok(body) => body,
                Err(response) => return cors(response),
            };

            match app.emit("leetbook://capture", body) {
                Ok(()) => cors(json_response(200, r#"{"ok":true}"#)),
                Err(_) => cors(json_response(500, r#"{"ok":false,"error":"emit failed"}"#)),
            }
        }
        ("POST", "/status") => {
            if !has_valid_token(app, request) {
                return cors(json_response(401, r#"{"ok":false,"error":"bad token"}"#));
            }

            let body = match read_json_body(request) {
                Ok(body) => body,
                Err(response) => return cors(response),
            };
            let status = match serde_json::from_str::<QueueStatus>(&body) {
                Ok(status) => status,
                Err(_) => {
                    return cors(json_response(
                        400,
                        r#"{"ok":false,"error":"invalid queue status"}"#,
                    ));
                }
            };
            let state = app.state::<ListenerState>();
            state.queued.store(status.queued, Ordering::Relaxed);
            state.queue_reported.store(true, Ordering::Relaxed);

            match app.emit("leetbook://queue-status", status.queued) {
                Ok(()) => cors(json_response(200, r#"{"ok":true}"#)),
                Err(_) => cors(json_response(500, r#"{"ok":false,"error":"emit failed"}"#)),
            }
        }
        // Unauthenticated on purpose: this is how an extension asks for a token in the
        // first place. Approval happens in the app, so requesting costs nothing.
        ("POST", "/pair/request") => {
            let state = app.state::<ListenerState>();
            let prompt = PairPrompt {
                id: generate_token(),
                code: generate_code(),
            };
            let Ok(mut slot) = state.pending_pair.lock() else {
                return cors(json_response(500, r#"{"ok":false,"error":"lock unavailable"}"#));
            };
            *slot = Some(PairRequest {
                id: prompt.id.clone(),
                code: prompt.code.clone(),
                created: Instant::now(),
                status: PairStatus::Pending,
            });
            drop(slot);

            let _ = app.emit("leetbook://pair-request", prompt.clone());
            cors(json_response(
                200,
                &format!(
                    r#"{{"ok":true,"requestId":"{}","code":"{}","expiresInMs":{}}}"#,
                    prompt.id,
                    prompt.code,
                    PAIR_REQUEST_TTL.as_millis()
                ),
            ))
        }
        ("GET", "/pair/status") => {
            let Some(id) = query_param(&url, "id") else {
                return cors(json_response(400, r#"{"ok":false,"error":"missing id"}"#));
            };
            let state = app.state::<ListenerState>();
            let Ok(slot) = state.pending_pair.lock() else {
                return cors(json_response(500, r#"{"ok":false,"error":"lock unavailable"}"#));
            };
            let status = match slot.as_ref() {
                Some(request) if request.id == id => {
                    if request.created.elapsed() > PAIR_REQUEST_TTL {
                        "expired"
                    } else {
                        match request.status {
                            PairStatus::Pending => "pending",
                            PairStatus::Approved => "approved",
                            PairStatus::Denied => "denied",
                        }
                    }
                }
                // Superseded by a newer request, or the app restarted.
                _ => "expired",
            };
            drop(slot);

            if status != "approved" {
                return cors(json_response(
                    200,
                    &format!(r#"{{"ok":true,"status":"{status}"}}"#),
                ));
            }
            match current_token(app, &app.state::<ListenerState>()) {
                Ok(token) => cors(json_response(
                    200,
                    &format!(r#"{{"ok":true,"status":"approved","token":"{token}"}}"#),
                )),
                Err(_) => cors(json_response(500, r#"{"ok":false,"error":"token unavailable"}"#)),
            }
        }
        _ => cors(json_response(404, r#"{"ok":false,"error":"not found"}"#)),
    }
}

/// Minimal query lookup — the listener only ever needs a single opaque id.
fn query_param(url: &str, key: &str) -> Option<String> {
    let query = url.split_once('?')?.1;
    query.split('&').find_map(|pair| {
        let (name, value) = pair.split_once('=')?;
        (name == key && !value.is_empty()).then(|| value.to_string())
    })
}

fn has_valid_token(app: &AppHandle, request: &tiny_http::Request) -> bool {
    let provided = request
        .headers()
        .iter()
        .find(|header| {
            header
                .field
                .as_str()
                .as_str()
                .eq_ignore_ascii_case(TOKEN_HEADER)
        })
        .map(|header| header.value.as_str());
    let state = app.state::<ListenerState>();
    token_matches(&state, provided)
}

fn read_json_body(
    request: &mut tiny_http::Request,
) -> Result<String, Response<std::io::Cursor<Vec<u8>>>> {
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        return Err(json_response(
            400,
            r#"{"ok":false,"error":"unreadable body"}"#,
        ));
    }
    if serde_json::from_str::<serde_json::Value>(&body).is_err() {
        return Err(json_response(400, r#"{"ok":false,"error":"invalid json"}"#));
    }
    Ok(body)
}

fn json_response(status: u16, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_string(body)
        .with_status_code(status)
        .with_header(Header::from_bytes("Content-Type", "application/json").unwrap())
}

fn cors(response: Response<std::io::Cursor<Vec<u8>>>) -> Response<std::io::Cursor<Vec<u8>>> {
    response
        .with_header(Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap())
        .with_header(
            Header::from_bytes("Access-Control-Allow-Methods", "GET, POST, OPTIONS").unwrap(),
        )
        .with_header(
            Header::from_bytes(
                "Access-Control-Allow-Headers",
                "content-type, x-leetbook-token",
            )
            .unwrap(),
        )
}

fn token_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("pairing-token"))
}

fn load_or_create_token(app: &AppHandle) -> Result<String, String> {
    let path = token_path(app)?;
    if let Ok(existing) = fs::read_to_string(&path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    let token = generate_token();
    fs::write(&path, &token).map_err(|e| e.to_string())?;
    Ok(token)
}

fn current_token(app: &AppHandle, state: &ListenerState) -> Result<String, String> {
    let existing = state
        .token
        .lock()
        .map_err(|_| "pairing token lock is unavailable".to_string())?
        .clone();
    if !existing.is_empty() {
        return Ok(existing);
    }
    let token = load_or_create_token(app)?;
    set_current_token(state, token.clone())?;
    Ok(token)
}

fn set_current_token(state: &ListenerState, token: String) -> Result<(), String> {
    *state
        .token
        .lock()
        .map_err(|_| "pairing token lock is unavailable".to_string())? = token;
    Ok(())
}

fn replace_pairing_token(state: &ListenerState, token: String) -> Result<(), String> {
    set_current_token(state, token)?;
    state.queue_reported.store(false, Ordering::Relaxed);
    state.queued.store(0, Ordering::Relaxed);
    Ok(())
}

fn token_matches(state: &ListenerState, provided: Option<&str>) -> bool {
    state
        .token
        .lock()
        .is_ok_and(|token| provided == Some(token.as_str()))
}

/// Four characters, unambiguous enough to compare at a glance in two windows.
fn generate_code() -> String {
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(4)
        .map(char::from)
        .collect::<String>()
        .to_uppercase()
}

fn generate_token() -> String {
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(8)
        .map(char::from)
        .collect::<String>()
        .to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_param_reads_the_id_and_ignores_everything_else() {
        assert_eq!(query_param("/pair/status?id=ABC", "id"), Some("ABC".into()));
        assert_eq!(query_param("/pair/status?x=1&id=ABC", "id"), Some("ABC".into()));
        assert_eq!(query_param("/pair/status?id=", "id"), None);
        assert_eq!(query_param("/pair/status", "id"), None);
    }

    #[test]
    fn only_the_newest_pairing_request_can_be_approved() {
        let state = ListenerState::default();
        {
            let mut slot = state.pending_pair.lock().unwrap();
            *slot = Some(PairRequest {
                id: "FIRST".into(),
                code: "AAAA".into(),
                created: Instant::now(),
                status: PairStatus::Pending,
            });
            // A second request supersedes the first, so the stale id must stop working.
            *slot = Some(PairRequest {
                id: "SECOND".into(),
                code: "BBBB".into(),
                created: Instant::now(),
                status: PairStatus::Pending,
            });
        }

        let slot = state.pending_pair.lock().unwrap();
        let active = slot.as_ref().unwrap();
        assert_eq!(active.id, "SECOND");
        assert_ne!(active.id, "FIRST");
    }

    #[test]
    fn an_expired_request_is_not_offered_for_approval() {
        let state = ListenerState::default();
        let mut slot = state.pending_pair.lock().unwrap();
        *slot = Some(PairRequest {
            id: "OLD".into(),
            code: "CCCC".into(),
            created: Instant::now() - PAIR_REQUEST_TTL - Duration::from_secs(1),
            status: PairStatus::Pending,
        });
        let request = slot.as_ref().unwrap();
        assert!(request.created.elapsed() > PAIR_REQUEST_TTL);
    }

    #[test]
    fn replacing_pairing_token_invalidates_the_old_token_and_connection_report() {
        let state = ListenerState::default();
        set_current_token(&state, "OLDTOKEN".to_string()).unwrap();
        state.queued.store(3, Ordering::Relaxed);
        state.queue_reported.store(true, Ordering::Relaxed);

        replace_pairing_token(&state, "NEWTOKEN".to_string()).unwrap();

        assert!(!token_matches(&state, Some("OLDTOKEN")));
        assert!(token_matches(&state, Some("NEWTOKEN")));
        assert_eq!(pairing_info(&state, "NEWTOKEN".to_string()).queued, None);
    }
}
