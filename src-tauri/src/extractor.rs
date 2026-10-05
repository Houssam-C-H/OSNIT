use crate::db::DbState;
use regex::Regex;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct ExtractionStats {
    pub new_entities: usize,
    pub new_links: usize,
}

#[tauri::command]
pub fn run_auto_extraction(state: tauri::State<'_, DbState>) -> Result<ExtractionStats, String> {
    let mut conn = state.conn.lock().map_err(|_| "Failed to lock database")?;

    // 1. Compile regex patterns outside the scanning loop for performance.
    // This avoids recompiling the regex engines on every single attribute row.
    let ip_regex = Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b").map_err(|e| format!("Failed to compile IP regex: {}", e))?;
    let email_regex = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").map_err(|e| format!("Failed to compile Email regex: {}", e))?;
    let btc_regex = Regex::new(r"\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b").map_err(|e| format!("Failed to compile BTC regex: {}", e))?;
    let eth_regex = Regex::new(r"\b0x[a-fA-F0-9]{40}\b").map_err(|e| format!("Failed to compile ETH regex: {}", e))?;

    // 2. Open SQLite Transaction for atomic batch processing
    // If the extraction errors halfway through, we revert everything to avoid ghost links.
    let tx = conn.transaction().map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut new_entities = 0;
    let mut new_links = 0;

    // 3. Fetch all attribute values that might contain hidden IoCs (length > 5)
    // We collect rows into a Vec to release the borrow on the transaction (tx) so we can run inner inserts.
    let mut attr_stmt = tx.prepare("SELECT entity_id, attribute_value FROM attributes WHERE length(attribute_value) > 5").map_err(|e| e.to_string())?;
    
    let rows: Vec<(String, String)> = attr_stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    
    drop(attr_stmt); // Explicit drop to satisfy borrow checker

    // 4. Iterate over the raw text and extract
    for (source_entity_id, text_value) in rows {
        let mut matches_found = Vec::new();

        // Scan for IPs
        for mat in ip_regex.find_iter(&text_value) {
            matches_found.push(("IP", mat.as_str().to_string()));
        }
        // Scan for Emails
        for mat in email_regex.find_iter(&text_value) {
            matches_found.push(("Email", mat.as_str().to_string()));
        }
        // Scan for BTC
        for mat in btc_regex.find_iter(&text_value) {
            matches_found.push(("CryptoWallet", mat.as_str().to_string()));
        }
        // Scan for ETH
        for mat in eth_regex.find_iter(&text_value) {
            matches_found.push(("CryptoWallet", mat.as_str().to_string()));
        }

        for (entity_type, matched_text) in matches_found {
            // Check if an entity with this exact indicator already exists
            let mut check_stmt = tx.prepare_cached("SELECT id FROM entities WHERE primary_name = ?1 LIMIT 1").map_err(|e| e.to_string())?;
            let existing_id: Option<String> = check_stmt.query_row(params![&matched_text], |row| row.get(0)).ok();
            
            let target_entity_id = match existing_id {
                Some(id) => id, // Reuse existing entity
                None => {
                    // Create new entity for the extracted IoC
                    let new_id = Uuid::new_v4().to_string();
                    tx.execute(
                        "INSERT INTO entities (id, entity_type, primary_name) VALUES (?1, ?2, ?3)",
                        params![&new_id, entity_type, &matched_text],
                    ).map_err(|e| format!("Failed to insert extracted entity: {}", e))?;
                    new_entities += 1;
                    new_id
                }
            };

            // Link the original source entity to the newly extracted target entity
            let link_result = tx.execute(
                "INSERT OR IGNORE INTO relationships (source_id, target_id, relationship_type) VALUES (?1, ?2, ?3)",
                params![&source_entity_id, &target_entity_id, "Extracted From"],
            );
            
            if let Ok(inserted) = link_result {
                if inserted > 0 {
                    new_links += 1;
                }
            }
        }
    }

    // 5. Commit all findings back to the encrypted database
    tx.commit().map_err(|e| format!("Failed to commit extraction transaction: {}", e))?;

    Ok(ExtractionStats {
        new_entities,
        new_links,
    })
}
