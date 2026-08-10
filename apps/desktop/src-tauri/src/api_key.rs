//! Stores the user's AI provider API key in the OS keychain.
//!
//! Not in SQLite. The key is a live credential with billing attached, and the database sits in
//! a folder that may be synced, backed up, or shared — and it is what `exportDatabaseJson`
//! serialises wholesale. Keeping the key outside that boundary means no export, backup or
//! copy of the database can ever leak it, with no carve-out to remember.
//!
//! macOS puts this in the login Keychain; Linux uses the Secret Service, Windows the
//! Credential Manager. All are encrypted at rest and unlocked by the user's session.

use keyring::Entry;

/// Namespace shown in Keychain Access, so the user can find and revoke it by hand.
const SERVICE: &str = "app.leetbook.desktop";
const ACCOUNT: &str = "anthropic-api-key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| format!("keychain unavailable: {error}"))
}

/// Saves (or replaces) the key. An empty string deletes it, so the UI has one write path.
#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    let entry = entry()?;
    if key.trim().is_empty() {
        return delete_entry(&entry);
    }
    entry
        .set_password(key.trim())
        .map_err(|error| format!("could not save the key: {error}"))
}

/// The stored key, or None when none is set. Never logged.
#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        // Nothing stored is the normal first-run state, not a failure.
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("could not read the key: {error}")),
    }
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    delete_entry(&entry()?)
}

fn delete_entry(entry: &Entry) -> Result<(), String> {
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // Deleting something that was never there is the outcome the caller wanted.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("could not remove the key: {error}")),
    }
}
