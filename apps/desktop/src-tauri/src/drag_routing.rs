//! Sends drags that started in the app, and file promises such as the Cmd-Shift-4 floating
//! thumbnail, to WebKit instead of Tauri's path-only drop handler. See `drag_routing.m`.

unsafe extern "C" {
    fn leetbook_install_drag_routing() -> i32;
}

pub fn install() {
    // Safe: the Objective-C side only swaps method implementations, once, on the main thread.
    if unsafe { leetbook_install_drag_routing() } == 0 {
        eprintln!("drag routing not installed: WryWebView class not found");
    }
}
