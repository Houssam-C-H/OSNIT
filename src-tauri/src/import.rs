use crate::db::DbState;
use rusqlite::params;
use std::fs::File;
use uuid::Uuid;

#[tauri::command]
pub fn preview_csv_headers(file_path: String) -> Result<Vec<String>, String> {
    let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    // We only read the first row using the csv crate's fast Reader
    let mut rdr = csv::ReaderBuilder::new().has_headers(true).from_reader(file);
    
    let headers = rdr.headers().map_err(|e| format!("Failed to read CSV headers: {}", e))?;
    
    let mut header_names = Vec::new();
    for header in headers.iter() {
        header_names.push(header.trim().to_string());
    }

    Ok(header_names)
}

#[tauri::command]
pub fn run_bulk_import(
    file_path: String,
    entity_type: String,
    name_column: String,
    attribute_columns: Vec<String>,
    state: tauri::State<'_, DbState>,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().map_err(|_| "Failed to lock database")?;

    let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut rdr = csv::ReaderBuilder::new().has_headers(true).from_reader(file);
    
    let headers = rdr.headers().map_err(|e| format!("Failed to read CSV headers: {}", e))?.clone();

    // Map column names to their indices for extremely fast lookup during the streaming loop
    let name_idx = headers.iter().position(|h| h.trim() == name_column)
        .ok_or("Name column not found in headers")?;
        
    let mut attr_indices = Vec::new();
    for attr in &attribute_columns {
        if let Some(idx) = headers.iter().position(|h| h.trim() == attr) {
            attr_indices.push((attr.clone(), idx));
        }
    }

    // Begin SQLite Transaction
    // SECURITY RATIONALE: Wrapping the massive insert block in an exclusive transaction prevents 
    // database corruption. If a row fails to parse or insert, we roll back everything.
    let tx = conn.transaction().map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut import_count = 0;

    for result in rdr.records() {
        let record = result.map_err(|e| format!("Error reading CSV row: {}", e))?;
        
        let entity_name = match record.get(name_idx) {
            Some(name) => name.trim(),
            None => continue, // Skip malformed rows safely
        };
        
        if entity_name.is_empty() {
            continue; // Skip rows with empty primary names
        }

        let entity_id = Uuid::new_v4().to_string();

        // 1. Insert Entity
        tx.execute(
            "INSERT INTO entities (id, entity_type, primary_name) VALUES (?1, ?2, ?3)",
            params![entity_id, entity_type.trim(), entity_name],
        ).map_err(|e| format!("Failed to insert entity: {}", e))?;

        // 2. Insert Attributes dynamically
        for (attr_key, idx) in &attr_indices {
            if let Some(attr_value) = record.get(*idx) {
                let trimmed_val = attr_value.trim();
                if !trimmed_val.is_empty() {
                    let attr_id = Uuid::new_v4().to_string();
                    tx.execute(
                        "INSERT INTO attributes (id, entity_id, attribute_key, attribute_value) VALUES (?1, ?2, ?3, ?4)",
                        params![attr_id, entity_id, attr_key.trim(), trimmed_val],
                    ).map_err(|e| format!("Failed to insert attribute: {}", e))?;
                }
            }
        }

        import_count += 1;
    }

    // Commit the entire batch to the encrypted SQLite file
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(import_count)
}
