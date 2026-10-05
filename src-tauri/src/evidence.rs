use std::fs::File;
use std::io::Read;
use std::path::Path;
use sha2::{Sha256, Digest};
use tauri::{AppHandle, Manager};
use crate::db::DbState;
use rusqlite::params;
use uuid::Uuid;

#[tauri::command]
pub fn ingest_evidence(app: AppHandle, entity_id: String, source_path: String) -> Result<String, String> {
    let path = Path::new(&source_path);
    if !path.exists() {
        return Err("Source file does not exist".to_string());
    }

    // Extract original filename safely
    let original_filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Read file in chunks and compute SHA-256
    let mut file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    let mut size_bytes = 0;

    loop {
        let count = file.read(&mut buffer).map_err(|e| format!("Failed to read file: {}", e))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        size_bytes += count;
    }

    let result = hasher.finalize();
    let file_hash = format!("{:x}", result);

    // Resolve secure app data dir
    let app_data_dir = app.path().app_data_dir().map_err(|_| "Failed to get app data directory".to_string())?;
    let evidence_dir = app_data_dir.join("evidence");
    
    std::fs::create_dir_all(&evidence_dir).map_err(|e| format!("Failed to create evidence directory: {}", e))?;

    // Save strictly using SHA-256 hash as filename (no extension, preventing directory traversal/execution)
    let dest_path = evidence_dir.join(&file_hash);

    if !dest_path.exists() {
        std::fs::copy(&source_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    // Insert record into SQLite (SQLCipher)
    let state = app.state::<DbState>();
    let conn = state.conn.lock().map_err(|_| "Failed to lock database".to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO attachments (id, entity_id, original_filename, file_hash, size_bytes) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![Uuid::new_v4().to_string(), entity_id, original_filename, file_hash, size_bytes],
    ).map_err(|e| format!("Database error: {}", e))?;

    Ok(file_hash)
}

#[tauri::command]
pub fn open_evidence(app: AppHandle, file_hash: String, original_filename: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| "Failed to get app data directory".to_string())?;
    let evidence_dir = app_data_dir.join("evidence");
    let secure_path = evidence_dir.join(&file_hash);

    if !secure_path.exists() {
        return Err("Evidence file not found in vault".to_string());
    }

    // Copy to a temp directory with the original filename so the OS knows how to open it
    let temp_dir = std::env::temp_dir().join("osint_case_manager_temp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    
    // Clean original filename just in case
    let safe_filename = original_filename.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != '_', "");
    let temp_file_path = temp_dir.join(safe_filename);
    
    std::fs::copy(&secure_path, &temp_file_path).map_err(|e| format!("Failed to copy file to temp: {}", e))?;

    // Open file using default OS viewer
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(temp_file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(temp_file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(temp_file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}
