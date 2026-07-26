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
};

use tauri::{AppHandle, Emitter, Manager, State};
use tiny_http::{Header, Method, Response, Server};

pub const PORT: u16 = 7749;
const TOKEN_HEADER: &str = "x-leetbook-token";

#[derive(serde::Serialize, Clone)]
pub struct PairingInfo {
    pub port: u16,
    pub token: String,
    pub listening: bool,
    pub queued: Option<usize>,
}

#[derive(Default)]
pub struct ListenerState {
    listening: AtomicBool,
    queued: AtomicUsize,
    queue_reported: AtomicBool,
    token: Mutex<String>,
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
    match (request.method(), request.url()) {
        // CORS preflight from the leetcode.com content script
        (Method::Options, _) => cors(Response::from_string("").with_status_code(204)),
        (Method::Get, "/ping") => cors(json_response(200, r#"{"ok":true,"app":"leetbook"}"#)),
        (Method::Post, "/capture") => {
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
        (Method::Post, "/status") => {
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
        _ => cors(json_response(404, r#"{"ok":false,"error":"not found"}"#)),
    }
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
