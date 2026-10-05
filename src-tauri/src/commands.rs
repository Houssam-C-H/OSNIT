use crate::db::DbState;
use tauri::Manager;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct Entity {
    pub id: String,
    pub entity_type: String,
    pub primary_name: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateEntityPayload {
    pub entity_type: String,
    pub primary_name: String,
}

// SECURITY RATIONALE: Input validation. The backend does not trust the client.
// All names are trimmed. Any HTML/Script tags are rendered harmless since we strictly treat them as strings in SQLite, 
// and the frontend handles DOMPurify before rendering anyway.

#[tauri::command]
pub fn get_entity_by_name(name: String, state: tauri::State<'_, DbState>) -> Result<Option<Entity>, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let mut stmt = conn.prepare("SELECT id, entity_type, primary_name FROM entities WHERE primary_name = ?1").map_err(|e| e.to_string())?;
    
    let mut entity_iter = stmt.query_map(params![name.trim()], |row| {
        Ok(Entity {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            primary_name: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    if let Some(entity) = entity_iter.next() {
        return Ok(Some(entity.map_err(|e| e.to_string())?));
    }
    
    Ok(None)
}

#[tauri::command]
pub fn create_entity(payload: CreateEntityPayload, state: tauri::State<'_, DbState>) -> Result<Entity, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let id = Uuid::new_v4().to_string();
    
    let entity_type = payload.entity_type.trim();
    let primary_name = payload.primary_name.trim();

    conn.execute(
        "INSERT INTO entities (id, entity_type, primary_name) VALUES (?1, ?2, ?3)",
        params![id, entity_type, primary_name],
    ).map_err(|e| e.to_string())?;

    Ok(Entity {
        id,
        entity_type: entity_type.to_string(),
        primary_name: primary_name.to_string(),
    })
}

#[tauri::command]
pub fn link_entities(source_id: String, target_id: String, relationship_type: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    
    conn.execute(
        "INSERT OR IGNORE INTO relationships (source_id, target_id, relationship_type) VALUES (?1, ?2, ?3)",
        params![source_id, target_id, relationship_type.trim()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddAttributePayload {
    pub entity_id: String,
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub fn add_attribute(payload: AddAttributePayload, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let id = Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO attributes (id, entity_id, attribute_key, attribute_value) VALUES (?1, ?2, ?3, ?4)",
        params![id, payload.entity_id, payload.key.trim(), payload.value.trim()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EntityPreview {
    pub id: String,
    pub entity_type: String,
    pub primary_name: String,
}

#[tauri::command]
pub fn search_entities(query: String, state: tauri::State<'_, DbState>) -> Result<Vec<EntityPreview>, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    
    // Parameterized LIKE query for partial matching
    let search_pattern = format!("%{}%", query.trim());
    
    let mut stmt = conn.prepare(
        "SELECT id, entity_type, primary_name 
         FROM entities 
         WHERE primary_name LIKE ?1 
         ORDER BY primary_name ASC 
         LIMIT 10"
    ).map_err(|e| e.to_string())?;
    
    let preview_iter = stmt.query_map(params![search_pattern], |row| {
        Ok(EntityPreview {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            primary_name: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for preview_result in preview_iter {
        match preview_result {
            Ok(preview) => results.push(preview),
            Err(e) => return Err(e.to_string()),
        }
    }
    
    Ok(results)
}

#[tauri::command]
pub fn get_all_notes(state: tauri::State<'_, DbState>) -> Result<Vec<EntityPreview>, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let mut stmt = conn.prepare("SELECT id, entity_type, primary_name FROM entities WHERE LOWER(entity_type) = 'note' ORDER BY primary_name ASC").map_err(|e| e.to_string())?;
    
    let preview_iter = stmt.query_map([], |row| {
        Ok(EntityPreview {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            primary_name: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for preview_result in preview_iter {
        match preview_result {
            Ok(preview) => results.push(preview),
            Err(e) => return Err(e.to_string()),
        }
    }
    
    Ok(results)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveNotePayload {
    pub id: Option<String>,
    pub title: String,
    pub content: String,
}

#[tauri::command]
pub fn save_markdown_note(payload: SaveNotePayload, state: tauri::State<'_, DbState>) -> Result<Entity, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    
    let entity_type = "Note";
    let primary_name = payload.title.trim();
    
    let note_id = if let Some(existing_id) = payload.id {
        existing_id
    } else {
        // Try to find if a note with this title already exists
        let mut stmt = conn.prepare("SELECT id FROM entities WHERE LOWER(entity_type) = 'note' AND primary_name = ?1").unwrap();
        let mut rows = stmt.query(params![primary_name]).unwrap();
        if let Some(row) = rows.next().unwrap() {
            row.get(0).unwrap()
        } else {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO entities (id, entity_type, primary_name) VALUES (?1, ?2, ?3)",
                params![id, entity_type, primary_name],
            ).map_err(|e| e.to_string())?;
            id
        }
    };

    // Upsert Note Content as an attribute
    conn.execute(
        "DELETE FROM attributes WHERE entity_id = ?1 AND attribute_key = 'content'",
        params![note_id],
    ).map_err(|e| e.to_string())?;

    let attr_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO attributes (id, entity_id, attribute_key, attribute_value) VALUES (?1, ?2, ?3, ?4)",
        params![attr_id, note_id, "content", payload.content],
    ).map_err(|e| e.to_string())?;

    Ok(Entity {
        id: note_id,
        entity_type: entity_type.to_string(),
        primary_name: primary_name.to_string(),
    })
}

#[tauri::command]
pub fn get_note_content(id: String, state: tauri::State<'_, DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let mut stmt = conn.prepare("SELECT attribute_value FROM attributes WHERE entity_id = ?1 AND attribute_key = 'content' LIMIT 1").map_err(|e| e.to_string())?;
    
    let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(row.get(0).unwrap_or_default());
    }
    
    Ok("".to_string())
}

#[tauri::command]
pub fn list_workspaces(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let app_data_dir = app_handle.path().app_data_dir().unwrap();
    let mut workspaces = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(app_data_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("db") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        workspaces.push(stem.to_string());
                    }
                }
            }
        }
    }
    
    Ok(workspaces)
}

#[tauri::command]
pub fn open_workspace(name: String, state: tauri::State<'_, DbState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().unwrap();
    // Validate name to prevent path traversal
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "");
    if safe_name.is_empty() {
        return Err("Invalid workspace name".to_string());
    }

    let db_path = app_data_dir.join(format!("{}.db", safe_name));
    let new_conn = crate::db::initialize_database(db_path.to_str().unwrap(), "secure_user_derived_key_here")
        .map_err(|e| e.to_string())?;
    
    let mut conn = state.conn.lock().unwrap();
    *conn = new_conn;
    Ok(())
}

#[tauri::command]
pub fn delete_entity(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    
    // SQLite foreign keys or manual cascade: We manually cascade here to be safe and cross-platform
    conn.execute("DELETE FROM attributes WHERE entity_id = ?1", params![&id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM relationships WHERE source_id = ?1 OR target_id = ?1", params![&id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM attachments WHERE entity_id = ?1", params![&id]).map_err(|e| e.to_string())?;
    
    // Delete the entity itself
    conn.execute("DELETE FROM entities WHERE id = ?1", params![&id]).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_link(source_id: String, target_id: String, relationship_type: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    conn.execute(
        "DELETE FROM relationships WHERE source_id = ?1 AND target_id = ?2 AND relationship_type = ?3",
        params![source_id, target_id, relationship_type],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_attribute(entity_id: String, key: String, value: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    // We match on key and value since a key could have multiple values (e.g. multiple "Phone" attributes)
    conn.execute(
        "DELETE FROM attributes WHERE entity_id = ?1 AND attribute_key = ?2 AND attribute_value = ?3",
        params![entity_id, key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_attribute(entity_id: String, old_key: String, old_value: String, new_key: String, new_value: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    conn.execute(
        "UPDATE attributes SET attribute_key = ?1, attribute_value = ?2 WHERE entity_id = ?3 AND attribute_key = ?4 AND attribute_value = ?5",
        params![new_key.trim(), new_value.trim(), entity_id, old_key, old_value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_entity(id: String, new_name: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    conn.execute(
        "UPDATE entities SET primary_name = ?1 WHERE id = ?2",
        params![new_name.trim(), id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ==========================================
// FULL ENTITY LOAD - FIXES #1 CRITICAL BUG
// ==========================================

#[derive(Serialize, Deserialize, Debug)]
pub struct FullAttribute {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FullRelationship {
    pub target_id: String,
    pub target_name: String,
    pub target_type: String,
    pub relationship_type: String,
    pub is_incoming: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FullAttachment {
    pub id: String,
    pub original_filename: String,
    pub file_hash: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FullEntity {
    pub id: String,
    pub entity_type: String,
    pub primary_name: String,
    pub created_at: String,
    pub updated_at: String,
    pub attributes: Vec<FullAttribute>,
    pub relationships: Vec<FullRelationship>,
    pub attachments: Vec<FullAttachment>,
}

#[tauri::command]
pub fn get_entity_full(id: String, state: tauri::State<'_, DbState>) -> Result<Option<FullEntity>, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let entity: Option<(String, String, String, String, String)> = conn.query_row(
        "SELECT id, entity_type, primary_name, created_at, updated_at FROM entities WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get::<_,String>(3).unwrap_or_default(), row.get::<_,String>(4).unwrap_or_default()))
    ).ok();
    let (eid, etype, ename, created_at, updated_at) = match entity { Some(e) => e, None => return Ok(None) };

    let mut attr_stmt = conn.prepare("SELECT attribute_key, attribute_value FROM attributes WHERE entity_id = ?1 ORDER BY attribute_key ASC").map_err(|e| e.to_string())?;
    let attrs: Vec<FullAttribute> = attr_stmt.query_map(params![id], |row| Ok(FullAttribute { key: row.get(0)?, value: row.get::<_,String>(1).unwrap_or_default() })).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    let mut rel_stmt = conn.prepare("
        SELECT CASE WHEN r.source_id = ?1 THEN r.target_id ELSE r.source_id END as connected_id,
               e.primary_name, e.entity_type, r.relationship_type,
               CASE WHEN r.target_id = ?1 THEN 1 ELSE 0 END as is_incoming
        FROM relationships r
        JOIN entities e ON (CASE WHEN r.source_id = ?1 THEN r.target_id ELSE r.source_id END) = e.id
        WHERE r.source_id = ?1 OR r.target_id = ?1
    ").map_err(|e| e.to_string())?;
    let rels: Vec<FullRelationship> = rel_stmt.query_map(params![id, id, id], |row| Ok(FullRelationship {
        target_id: row.get(0)?, target_name: row.get(1)?, target_type: row.get(2)?,
        relationship_type: row.get(3)?, is_incoming: row.get::<_,i32>(4).unwrap_or(0) == 1,
    })).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    let mut att_stmt = conn.prepare("SELECT id, original_filename, file_hash, mime_type, size_bytes, created_at FROM attachments WHERE entity_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let atts: Vec<FullAttachment> = att_stmt.query_map(params![id], |row| Ok(FullAttachment {
        id: row.get(0)?, original_filename: row.get(1)?, file_hash: row.get(2)?,
        mime_type: row.get(3)?, size_bytes: row.get::<_,i64>(4).unwrap_or(0),
        created_at: row.get::<_,String>(5).unwrap_or_default(),
    })).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    Ok(Some(FullEntity { id: eid, entity_type: etype, primary_name: ename, created_at, updated_at, attributes: attrs, relationships: rels, attachments: atts }))
}

// ==========================================
// VAULT STATS (live footer)
// ==========================================

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultStats {
    pub entity_count: i64,
    pub relationship_count: i64,
    pub attachment_count: i64,
}

#[tauri::command]
pub fn get_vault_stats(state: tauri::State<'_, DbState>) -> Result<VaultStats, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let entity_count: i64 = conn.query_row("SELECT COUNT(*) FROM entities WHERE LOWER(entity_type) != 'note'", [], |r| r.get(0)).unwrap_or(0);
    let relationship_count: i64 = conn.query_row("SELECT COUNT(*) FROM relationships", [], |r| r.get(0)).unwrap_or(0);
    let attachment_count: i64 = conn.query_row("SELECT COUNT(*) FROM attachments", [], |r| r.get(0)).unwrap_or(0);
    Ok(VaultStats { entity_count, relationship_count, attachment_count })
}

// ==========================================
// PAGINATED ENTITY SEARCH (fixes LIMIT 10)
// ==========================================

#[tauri::command]
pub fn search_entities_paginated(query: String, entity_type_filter: String, offset: i64, limit: i64, state: tauri::State<'_, DbState>) -> Result<Vec<EntityPreview>, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let search_pattern = format!("%{}%", query.trim());
    let results: Vec<EntityPreview> = if entity_type_filter.is_empty() || entity_type_filter == "all" {
        let mut stmt = conn.prepare("SELECT id, entity_type, primary_name FROM entities WHERE primary_name LIKE ?1 AND LOWER(entity_type) != 'note' ORDER BY primary_name ASC LIMIT ?2 OFFSET ?3").map_err(|e| e.to_string())?;
        let res: Vec<EntityPreview> = stmt.query_map(params![search_pattern, limit, offset], |row| Ok(EntityPreview { id: row.get(0)?, entity_type: row.get(1)?, primary_name: row.get(2)? })).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
        res
    } else {
        let mut stmt = conn.prepare("SELECT id, entity_type, primary_name FROM entities WHERE primary_name LIKE ?1 AND LOWER(entity_type) = LOWER(?2) ORDER BY primary_name ASC LIMIT ?3 OFFSET ?4").map_err(|e| e.to_string())?;
        let res: Vec<EntityPreview> = stmt.query_map(params![search_pattern, entity_type_filter, limit, offset], |row| Ok(EntityPreview { id: row.get(0)?, entity_type: row.get(1)?, primary_name: row.get(2)? })).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
        res
    };
    Ok(results)
}

// ==========================================
// EXTRACTION DRY-RUN PREVIEW (gap #20)
// ==========================================

#[derive(Serialize, Deserialize, Debug)]
pub struct ExtractionMatch {
    pub source_entity_id: String,
    pub source_entity_name: String,
    pub matched_type: String,
    pub matched_value: String,
    pub already_exists: bool,
}

#[tauri::command]
pub fn preview_auto_extraction(state: tauri::State<'_, DbState>) -> Result<Vec<ExtractionMatch>, String> {
    use regex::Regex;
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let ip_regex = Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b").map_err(|e| e.to_string())?;
    let email_regex = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").map_err(|e| e.to_string())?;
    let btc_regex = Regex::new(r"\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b").map_err(|e| e.to_string())?;
    let eth_regex = Regex::new(r"\b0x[a-fA-F0-9]{40}\b").map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT a.entity_id, e.primary_name, a.attribute_value FROM attributes a JOIN entities e ON a.entity_id = e.id WHERE length(a.attribute_value) > 5").map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    let mut matches = Vec::new();
    for (source_id, source_name, text) in rows {
        let mut found: Vec<(&str, String)> = Vec::new();
        for m in ip_regex.find_iter(&text) { found.push(("ip_address", m.as_str().to_string())); }
        for m in email_regex.find_iter(&text) { found.push(("email", m.as_str().to_string())); }
        for m in btc_regex.find_iter(&text) { found.push(("crypto_wallet", m.as_str().to_string())); }
        for m in eth_regex.find_iter(&text) { found.push(("crypto_wallet", m.as_str().to_string())); }
        for (mtype, mvalue) in found {
            let already_exists = conn.query_row("SELECT COUNT(*) FROM entities WHERE primary_name = ?1", params![&mvalue], |r| r.get::<_,i64>(0)).unwrap_or(0) > 0;
            matches.push(ExtractionMatch { source_entity_id: source_id.clone(), source_entity_name: source_name.clone(), matched_type: mtype.to_string(), matched_value: mvalue, already_exists });
        }
    }
    Ok(matches)
}

// ==========================================
// TAG / CONFIDENCE CLASSIFICATION
// ==========================================

#[tauri::command]
pub fn set_entity_tag(entity_id: String, tag: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    let id = Uuid::new_v4().to_string();
    conn.execute("INSERT OR IGNORE INTO attributes (id, entity_id, attribute_key, attribute_value) VALUES (?1, ?2, '_tag', ?3)", params![id, entity_id, tag.trim()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_entity_tag(entity_id: String, tag: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    conn.execute("DELETE FROM attributes WHERE entity_id = ?1 AND attribute_key = '_tag' AND attribute_value = ?2", params![entity_id, tag.trim()]).map_err(|e| e.to_string())?;
    Ok(())
}
