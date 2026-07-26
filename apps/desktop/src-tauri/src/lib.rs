mod capture_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(capture_server::ListenerState::default())
        .invoke_handler(tauri::generate_handler![capture_server::get_pairing_info])
        .setup(|app| {
            if let Err(error) = capture_server::start(app.handle().clone()) {
                // Port taken (e.g. second instance): the app still works, capture doesn't.
                eprintln!("capture server failed to start: {error}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LeetBook");
}
