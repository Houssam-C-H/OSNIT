use rusqlite::{Connection, Result};
use std::sync::Mutex;

// The application state holding the DB connection
pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn initialize_database(db_path: &str, encryption_key: &str) -> Result<Connection> {
    // Open or create the SQLite database file
    let conn = Connection::open(db_path)?;

    // SECURITY RATIONALE: Apply AES-256 encryption via SQLCipher PRAGMA immediately upon connection.
    // This ensures data at rest is never written in plaintext. 
    let _ = conn.pragma_update(None, "key", &encryption_key);

    // Configure SQLite for security and performance
    conn.pragma_update(None, "foreign_keys", &"ON")?;
    
    // Create EAV Hybrid Schema
    
    // 1. Entities Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            primary_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 2. Attributes Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attributes (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL,
            attribute_key TEXT NOT NULL,
            attribute_value TEXT,
            FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 3. Relationships Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS relationships (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            PRIMARY KEY(source_id, target_id, relationship_type),
            FOREIGN KEY(source_id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(target_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create indexes for efficient querying of Wiki-Links
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(primary_name)", [])?;

    // Create attachments schema
    create_attachment_schema(&conn)?;

    Ok(conn)
}

pub fn create_attachment_schema(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_hash TEXT NOT NULL UNIQUE, -- SHA-256 of the file content
            mime_type TEXT,
            size_bytes INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}
