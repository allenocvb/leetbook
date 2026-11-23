fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/drag_routing.m")
            .flag("-fobjc-arc")
            .flag("-fblocks")
            .compile("leetbook_drag_routing");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rerun-if-changed=src/drag_routing.m");
    }
    tauri_build::build()
}
