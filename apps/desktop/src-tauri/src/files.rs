use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

const MAX_FILE: u64 = 100 * 1024 * 1024;

fn file_path(root: &Path, id: &str, name: &str) -> Result<PathBuf, String> {
    if id.len() != 36
        || !id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
        || name.is_empty()
        || name == "."
        || name == ".."
        || name.contains(['/', '\\'])
    {
        return Err("Invalid stored file reference".into());
    }
    Ok(root.join("files").join(id).join(name))
}

fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct ImportedFile {
    name: String,
    size: u64,
}

// Blocking filesystem work runs on Tauri's blocking pool, never on the UI thread.
#[tauri::command]
pub async fn import_library_file(
    app: tauri::AppHandle,
    source: String,
    id: String,
) -> Result<ImportedFile, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = Path::new(&source);
        let name = source
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?
            .to_owned();
        let mut input = fs::File::open(source).map_err(|e| e.to_string())?;
        let meta = input.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() || meta.len() > MAX_FILE {
            return Err("Choose a file up to 100 MB".into());
        }
        let destination = file_path(&root(&app)?, &id, &name)?;
        let parent = destination.parent().ok_or("Invalid destination")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
            .map_err(|e| e.to_string())?;
        let result = std::io::copy(
            &mut Read::by_ref(&mut input).take(MAX_FILE + 1),
            &mut output,
        )
        .and_then(|size| {
            output.flush()?;
            Ok(size)
        });
        match result {
            Ok(size) if size <= MAX_FILE => Ok(ImportedFile { name, size }),
            _ => {
                let _ = fs::remove_file(destination);
                Err("Could not copy this file (100 MB maximum)".into())
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_library_file(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let path = file_path(&root(&app)?, &id, &name)?;
    if !path.is_file() {
        return Err("This saved file is missing".into());
    }
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Only used to roll back a copied file if its database insert fails.
#[tauri::command]
pub fn discard_library_file(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    fs::remove_file(file_path(&root(&app)?, &id, &name)?).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn confines_saved_files_to_the_library() {
        let root = Path::new("/tmp/leetbook-test");
        let id = "00000000-0000-0000-0000-000000000001";
        assert_eq!(
            file_path(root, id, "notes.pdf").unwrap(),
            root.join("files").join(id).join("notes.pdf")
        );
        for name in ["../secret", "..", "nested/file", "nested\\file", ""] {
            assert!(file_path(root, id, name).is_err());
        }
        assert!(file_path(root, "../../outside", "notes.pdf").is_err());
    }
}
