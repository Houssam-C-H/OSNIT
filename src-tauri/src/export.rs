use crate::db::DbState;
use rusqlite::Connection;
use serde::Serialize;
use std::fs::File;
use std::io::{Read, Write};
use tauri::{AppHandle, Manager};
use zip::{write::FileOptions, CompressionMethod, ZipWriter};

#[derive(Serialize)]
pub struct IntelligenceSnapshot {
    pub entities: Vec<EntityRecord>,
    pub attributes: Vec<AttributeRecord>,
    pub relationships: Vec<RelationshipRecord>,
    pub attachments: Vec<AttachmentRecord>,
}

#[derive(Serialize)]
pub struct EntityRecord {
    pub id: String,
    pub entity_type: String,
    pub primary_name: String,
}

#[derive(Serialize)]
pub struct AttributeRecord {
    pub entity_id: String,
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct RelationshipRecord {
    pub source_id: String,
    pub target_id: String,
    pub relationship_type: String,
}

#[derive(Serialize)]
pub struct AttachmentRecord {
    pub id: String,
    pub entity_id: String,
    pub original_filename: String,
    pub file_hash: String,
}

#[tauri::command]
pub fn export_secure_archive(
    app: AppHandle,
    target_path: String,
    archive_password: String,
) -> Result<String, String> {
    let state = app.state::<DbState>();
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;

    // 1. Snapshot the complete Intelligence Database
    let snapshot = build_snapshot(&conn)?;
    let json_report = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;

    // 2. Initialize ZIP Writer
    let file = File::create(&target_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    // SECURITY RATIONALE: Enforce AES-256 encryption on the ZIP payload.
    // This ensures that even if the archive is intercepted via an unencrypted channel (e.g., email), 
    // the intelligence report and evidence files remain strictly locked.
    let options: FileOptions<()> = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .with_aes_encryption(zip::AesMode::Aes256, &archive_password);

    // 3. Write structured JSON Report
    zip.start_file("intelligence_report.json", options.clone())
        .map_err(|e| e.to_string())?;
    zip.write_all(json_report.as_bytes())
        .map_err(|e| e.to_string())?;

    // 4. Iterate over Attachments and embed secure evidence files
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Failed to get app data directory")?;
    let evidence_dir = app_data_dir.join("evidence");

    // Add the evidence directory logically to the zip (creates a folder structure)
    zip.add_directory("evidence/", options.clone()).map_err(|e| e.to_string())?;

    for attachment in snapshot.attachments {
        let secure_file_path = evidence_dir.join(&attachment.file_hash);

        // Verify the secure hash file exists in our vault
        if secure_file_path.exists() {
            // Write the file into the 'evidence/' folder inside the ZIP, restoring its original filename
            let zip_internal_path = format!("evidence/{}", attachment.original_filename);
            
            zip.start_file(zip_internal_path, options.clone())
                .map_err(|e| format!("Failed to start ZIP file entry: {}", e))?;
                
            let mut f = File::open(&secure_file_path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    Ok(format!("Secure archive successfully generated at {}", target_path))
}

// Helper function to extract everything from SQLite cleanly
fn build_snapshot(conn: &Connection) -> Result<IntelligenceSnapshot, String> {
    let mut entities = Vec::new();
    let mut stmt = conn.prepare("SELECT id, entity_type, primary_name FROM entities").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(EntityRecord { id: r.get(0)?, entity_type: r.get(1)?, primary_name: r.get(2)? })).map_err(|e| e.to_string())?;
    for row in rows { entities.push(row.map_err(|e| e.to_string())?); }

    let mut attributes = Vec::new();
    let mut stmt = conn.prepare("SELECT entity_id, attribute_key, attribute_value FROM attributes").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(AttributeRecord { entity_id: r.get(0)?, key: r.get(1)?, value: r.get(2)? })).map_err(|e| e.to_string())?;
    for row in rows { attributes.push(row.map_err(|e| e.to_string())?); }

    let mut relationships = Vec::new();
    let mut stmt = conn.prepare("SELECT source_id, target_id, relationship_type FROM relationships").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(RelationshipRecord { source_id: r.get(0)?, target_id: r.get(1)?, relationship_type: r.get(2)? })).map_err(|e| e.to_string())?;
    for row in rows { relationships.push(row.map_err(|e| e.to_string())?); }

    let mut attachments = Vec::new();
    let mut stmt = conn.prepare("SELECT id, entity_id, original_filename, file_hash FROM attachments").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(AttachmentRecord { id: r.get(0)?, entity_id: r.get(1)?, original_filename: r.get(2)?, file_hash: r.get(3)? })).map_err(|e| e.to_string())?;
    for row in rows { attachments.push(row.map_err(|e| e.to_string())?); }

    Ok(IntelligenceSnapshot { entities, attributes, relationships, attachments })
}
