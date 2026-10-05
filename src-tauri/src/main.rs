mod db;
mod commands;
mod evidence;
mod graph;
mod import;
mod extractor;
mod export;

use std::sync::Mutex;
use tauri::Manager;
// Force rebuild

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Setup DbState
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            
            let db_path = app_data_dir.join("osint_case_manager.db");
            
            // SECURITY RATIONALE: Key should ideally come from user input (password) or secure enclave.
            // Using a placeholder strictly for boilerplate purposes.
            let encryption_key = "secure_user_derived_key_here";
            
            let conn = db::initialize_database(
                db_path.to_str().unwrap(),
                encryption_key
            ).expect("Failed to initialize encrypted database");

            app.manage(db::DbState {
                conn: Mutex::new(conn),
            });

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_entity_by_name,
            commands::create_entity,
            commands::link_entities,
            commands::add_attribute,
            commands::search_entities,
            commands::get_all_notes,
            commands::get_note_content,
            commands::save_markdown_note,
            commands::list_workspaces,
            commands::open_workspace,
            commands::delete_entity,
            commands::delete_link,
            commands::delete_attribute,
            commands::update_attribute,
            commands::update_entity,
            commands::get_entity_full,
            commands::get_vault_stats,
            commands::search_entities_paginated,
            commands::preview_auto_extraction,
            commands::set_entity_tag,
            commands::remove_entity_tag,
            evidence::ingest_evidence,
            evidence::open_evidence,
            graph::get_network_graph,
            import::preview_csv_headers,
            import::run_bulk_import,
            extractor::run_auto_extraction,
            export::export_secure_archive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
