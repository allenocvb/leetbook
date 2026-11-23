//! macOS screenshot thumbnails carry NSFilePromiseReceiver objects, not existing paths.
use std::{
    ffi::{c_char, c_void, CStr, CString},
    sync::OnceLock,
};
use tauri::{Emitter, Manager};
static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
unsafe extern "C" {
    fn leetbook_install_file_promises(
        view: *mut c_void,
        root: *const c_char,
        callback: extern "C" fn(*const c_char),
    );
}
extern "C" fn receive(json: *const c_char) {
    if json.is_null() {
        return;
    }
    let json = unsafe { CStr::from_ptr(json) }.to_string_lossy();
    if let (Some(app), Ok(payload)) = (APP.get(), serde_json::from_str::<serde_json::Value>(&json))
    {
        let _ = app.emit_to("main", "leetbook://promised-drop", payload);
    }
}
pub fn install(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let root = app.path().app_cache_dir()?.join("screenshot-drops");
    std::fs::create_dir_all(&root)?;
    // Old unclaimed promises are temporary. Keep recent drops intact across quick restarts.
    for entry in std::fs::read_dir(&root)?.flatten() {
        if entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|m| m.elapsed().ok())
            .is_some_and(|age| age.as_secs() > 86400)
        {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
    let root = CString::new(root.to_string_lossy().as_bytes())?;
    let _ = APP.set(app.clone());
    if let Some(window) = app.get_webview_window("main") {
        window.with_webview(move |webview| unsafe {
            leetbook_install_file_promises(webview.inner().cast(), root.as_ptr(), receive);
        })?;
    }
    Ok(())
}
