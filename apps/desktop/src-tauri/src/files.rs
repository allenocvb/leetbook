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
        copy_to_library(&root(&app)?, Path::new(&source), &id)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn copy_to_library(root: &Path, source: &Path, id: &str) -> Result<ImportedFile, String> {
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
    let destination = file_path(root, id, &name)?;
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
}

const MAX_FOLDER_ENTRIES: usize = 2000;

/// One item found when expanding dropped or picked paths. `folders` is the chain of folder
/// names it sits in, starting with the top-level folder that was dropped; empty for a loose file.
#[derive(serde::Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySource {
    kind: &'static str,
    source: String,
    folders: Vec<String>,
}

/// Expands dropped/picked paths into files and folders, preserving each folder's hierarchy.
/// Hidden entries (".DS_Store", ".git") and symlinks are skipped.
#[tauri::command]
pub async fn expand_library_sources(paths: Vec<String>) -> Result<Vec<LibrarySource>, String> {
    tauri::async_runtime::spawn_blocking(move || expand_sources(&paths))
        .await
        .map_err(|e| e.to_string())?
}

fn expand_sources(paths: &[String]) -> Result<Vec<LibrarySource>, String> {
    let mut found = Vec::new();
    for path in paths {
        let path = Path::new(path);
        let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
        if meta.is_dir() {
            walk(path, Vec::new(), &mut found)?;
        } else if meta.is_file() {
            found.push(LibrarySource {
                kind: "file",
                source: path.to_string_lossy().into_owned(),
                folders: Vec::new(),
            });
        }
    }
    Ok(found)
}

fn walk(dir: &Path, mut trail: Vec<String>, found: &mut Vec<LibrarySource>) -> Result<(), String> {
    let name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid folder name")?
        .to_owned();
    trail.push(name);
    found.push(LibrarySource {
        kind: "folder",
        source: dir.to_string_lossy().into_owned(),
        folders: trail.clone(),
    });
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .collect();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        if found.len() >= MAX_FOLDER_ENTRIES {
            return Err(format!("Folders can hold up to {MAX_FOLDER_ENTRIES} items per upload"));
        }
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            walk(&entry.path(), trail.clone(), found)?;
        } else if kind.is_file() {
            found.push(LibrarySource {
                kind: "file",
                source: entry.path().to_string_lossy().into_owned(),
                folders: trail.clone(),
            });
        }
    }
    Ok(())
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
    fn copies_bytes_without_overwriting_and_survives_source_removal() {
        let root = std::env::temp_dir().join(format!("leetbook-library-{}", rand::random::<u64>()));
        fs::create_dir_all(&root).unwrap();
        let source = root.join("reference.pdf");
        let id = "00000000-0000-0000-0000-000000000001";
        fs::write(&source, b"test document bytes").unwrap();
        let imported = copy_to_library(&root, &source, id).unwrap();
        assert_eq!(imported.name, "reference.pdf");
        assert_eq!(imported.size, 19);
        assert!(copy_to_library(&root, &source, id).is_err());
        fs::remove_file(source).unwrap();
        let saved = file_path(&root, id, &imported.name).unwrap();
        assert_eq!(fs::read(saved).unwrap(), b"test document bytes");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn expands_folders_with_their_hierarchy_and_skips_hidden_entries() {
        let root = std::env::temp_dir().join(format!("leetbook-expand-{}", rand::random::<u64>()));
        let top = root.join("Graphs");
        fs::create_dir_all(top.join("BFS")).unwrap();
        fs::create_dir_all(top.join("Empty")).unwrap();
        fs::write(top.join("intro.md"), b"x").unwrap();
        fs::write(top.join(".DS_Store"), b"x").unwrap();
        fs::write(top.join("BFS").join("grid.pdf"), b"x").unwrap();
        let loose = root.join("loose.txt");
        fs::write(&loose, b"x").unwrap();

        let found = expand_sources(&[
            top.to_string_lossy().into_owned(),
            loose.to_string_lossy().into_owned(),
        ])
        .unwrap();
        let summary: Vec<(&str, String)> = found
            .iter()
            .map(|item| (item.kind, item.folders.join("/")))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("folder", "Graphs".to_string()),
                ("folder", "Graphs/BFS".to_string()),
                ("file", "Graphs/BFS".to_string()),
                ("folder", "Graphs/Empty".to_string()),
                ("file", "Graphs".to_string()),
                ("file", String::new()),
            ]
        );
        fs::remove_dir_all(root).unwrap();
    }

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

/// Screenshot bytes are embedded in the note JSON, never fetched from remote URLs.
#[tauri::command]
pub async fn read_note_image(path: String) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || read_image_bytes(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())?
}

fn read_image_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let meta = file.metadata().map_err(|e| e.to_string())?;
    const MAX_IMAGE: u64 = 10 * 1024 * 1024;
    if !meta.is_file() || meta.len() > MAX_IMAGE {
        return Err("Images must be 10 MB or smaller".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_IMAGE + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_IMAGE {
        return Err("Images must be 10 MB or smaller".into());
    }
    Ok(bytes)
}

#[cfg(test)]
mod image_tests {
    use super::*;
    #[test]
    fn reads_bytes_and_rejects_large_images() {
        let path =
            std::env::temp_dir().join(format!("leetbook-image-{}.png", rand::random::<u64>()));
        fs::write(&path, [137, 80, 78, 71]).unwrap();
        assert_eq!(read_image_bytes(&path).unwrap(), vec![137, 80, 78, 71]);
        fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len(10 * 1024 * 1024 + 1)
            .unwrap();
        assert!(read_image_bytes(&path).unwrap_err().contains("10 MB"));
        fs::remove_file(path).unwrap();
    }
}
