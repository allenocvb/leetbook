//! Localhost listener the browser extension posts captured submissions to.
//!
//! Fixed port + a pairing token persisted in the app data dir. Valid payloads
//! are forwarded to the webview as a `leetbook://capture` event; all business
//! logic stays in TypeScript (packages/core).

use std::{fs, io::Read, path::PathBuf, thread};

use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Header, Method, Response, Server};

pub const PORT: u16 = 7749;
const TOKEN_HEADER: &str = "x-leetbook-token";

#[derive(serde::Serialize, Clone)]
pub struct PairingInfo {
    pub port: u16,
    pub token: String,
}

#[tauri::command]
pub fn get_pairing_info(app: AppHandle) -> Result<PairingInfo, String> {
    Ok(PairingInfo {
        port: PORT,
        token: load_or_create_token(&app)?,
    })
}

pub fn start(app: AppHandle) -> Result<(), String> {
    let token = load_or_create_token(&app)?;
    let server = Server::http(("127.0.0.1", PORT)).map_err(|e| e.to_string())?;
    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let response = handle(&app, &token, &mut request);
            let _ = request.respond(response);
        }
    });
    Ok(())
}

fn handle(
    app: &AppHandle,
    token: &str,
    request: &mut tiny_http::Request,
) -> Response<std::io::Cursor<Vec<u8>>> {
    match (request.method(), request.url()) {
        // CORS preflight from the leetcode.com content script
        (Method::Options, _) => cors(Response::from_string("").with_status_code(204)),
        (Method::Get, "/ping") => cors(json_response(200, r#"{"ok":true,"app":"leetbook"}"#)),
        (Method::Post, "/capture") => {
            let provided = request
                .headers()
                .iter()
                .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(TOKEN_HEADER))
                .map(|h| h.value.as_str().to_string());
            if provided.as_deref() != Some(token) {
                return cors(json_response(401, r#"{"ok":false,"error":"bad token"}"#));
            }

            let mut body = String::new();
            if request.as_reader().read_to_string(&mut body).is_err() {
                return cors(json_response(400, r#"{"ok":false,"error":"unreadable body"}"#));
            }
            if serde_json::from_str::<serde_json::Value>(&body).is_err() {
                return cors(json_response(400, r#"{"ok":false,"error":"invalid json"}"#));
            }

            match app.emit("leetbook://capture", body) {
                Ok(()) => cors(json_response(200, r#"{"ok":true}"#)),
                Err(_) => cors(json_response(500, r#"{"ok":false,"error":"emit failed"}"#)),
            }
        }
        _ => cors(json_response(404, r#"{"ok":false,"error":"not found"}"#)),
    }
}

fn json_response(status: u16, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_string(body)
        .with_status_code(status)
        .with_header(Header::from_bytes("Content-Type", "application/json").unwrap())
}

fn cors(response: Response<std::io::Cursor<Vec<u8>>>) -> Response<std::io::Cursor<Vec<u8>>> {
    response
        .with_header(Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap())
        .with_header(Header::from_bytes("Access-Control-Allow-Methods", "GET, POST, OPTIONS").unwrap())
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

fn generate_token() -> String {
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(8)
        .map(char::from)
        .collect::<String>()
        .to_uppercase()
}
