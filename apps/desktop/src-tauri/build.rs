fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/file_promises.m")
            .flag("-fobjc-arc")
            .flag("-fblocks")
            .compile("leetbook_file_promises");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rerun-if-changed=src/file_promises.m");
    }
    tauri_build::build()
}
