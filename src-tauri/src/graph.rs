use crate::db::DbState;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct GraphNode {
    pub id: String,
    pub primary_name: String,
    pub entity_type: String,
    pub custom_logo_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GraphLink {
    pub source: String, // 'source' and 'target' are used by force-graph library natively
    pub target: String,
    pub relationship_type: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GraphPayload {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[tauri::command]
pub fn get_network_graph(state: tauri::State<'_, DbState>) -> Result<GraphPayload, String> {
    let conn = state.conn.lock().map_err(|_| "Failed to lock database")?;
    
    // 1. Query all entities (Nodes) EXCEPT Notes, including custom logo if available
    let mut node_stmt = conn.prepare("
        SELECT e.id, e.primary_name, e.entity_type,
               (SELECT attribute_value FROM attributes a WHERE a.entity_id = e.id AND a.attribute_key = 'logo_url' LIMIT 1) as custom_logo_url
        FROM entities e 
        WHERE LOWER(e.entity_type) != 'note'
    ").map_err(|e| e.to_string())?;
    
    let node_iter = node_stmt.query_map([], |row| {
        Ok(GraphNode {
            id: row.get(0)?,
            primary_name: row.get(1)?,
            entity_type: row.get(2)?,
            custom_logo_url: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    for node in node_iter {
        nodes.push(node.map_err(|e| e.to_string())?);
    }

    // 2. Query all relationships (Links/Edges) EXCEPT those involving Notes
    let mut link_stmt = conn.prepare("
        SELECT r.source_id, r.target_id, r.relationship_type 
        FROM relationships r
        JOIN entities e1 ON r.source_id = e1.id
        JOIN entities e2 ON r.target_id = e2.id
        WHERE LOWER(e1.entity_type) != 'note' AND LOWER(e2.entity_type) != 'note'
    ").map_err(|e| e.to_string())?;
    let link_iter = link_stmt.query_map([], |row| {
        Ok(GraphLink {
            source: row.get(0)?,
            target: row.get(1)?,
            relationship_type: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut links = Vec::new();
    for link in link_iter {
        links.push(link.map_err(|e| e.to_string())?);
    }

    Ok(GraphPayload { nodes, links })
}
