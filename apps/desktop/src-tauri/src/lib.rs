mod api_key;
mod capture_server;
mod files;
#[cfg(target_os = "macos")]
mod file_promises;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(capture_server::ListenerState::default())
        .invoke_handler(tauri::generate_handler![
            capture_server::get_pairing_info,
            capture_server::regenerate_pairing_token,
            capture_server::pending_pair_request,
            capture_server::resolve_pair_request,
            api_key::save_api_key,
            api_key::load_api_key,
            api_key::delete_api_key,
            files::import_library_file,
            files::open_library_file,
            files::discard_library_file,
            files::read_note_image
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Err(error) = file_promises::install(app.handle()) {
                eprintln!("screenshot drop setup failed: {error}");
            }
            if let Err(error) = capture_server::start(app.handle().clone()) {
                // Port taken (e.g. second instance): the app still works, capture doesn't.
                eprintln!("capture server failed to start: {error}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LeetBook");
}
