use std::sync::Arc;
use tauri::State;
use crate::db;
use crate::state::AppState;

use db::DbMessage;

pub fn get_history(peer_ip: String, state: State<Arc<AppState>>) -> Vec<DbMessage> {
    let db = state.db.lock().unwrap();
    let count = db::debug_count(&db, &peer_ip);
    println!("[DEBUG] get_history for {}: {} messages", peer_ip, count);
    db::load_history(&db, &peer_ip, &state.db_key).unwrap_or_default()
}

pub fn get_saved_peers(state: State<Arc<AppState>>) -> Vec<serde_json::Value> {
    let db = state.db.lock().unwrap();
    db::load_peers(&db)
        .unwrap_or_default()
        .into_iter()
        .map(|(ip, name)| serde_json::json!({ "ip": ip, "name": name }))
        .collect()
}