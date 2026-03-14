// src-tauri/src/db.rs

use rusqlite::{Connection, Result as SqlResult, params};
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

use base64::{Engine as _, engine::general_purpose};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use rand;
// On réutilise la structure ChatMessage, mais on peut la redéfinir ici si besoin
// ou l'importer depuis main.rs si on la rend publique.
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DbMessage {
    pub sender_name: String,
    pub content: String,
}

// Fonction pour trouver le chemin du fichier DB
fn get_db_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("airgap");
    fs::create_dir_all(&path).ok();
    path.push("airgap.db");
    path
}

// Initialise la connexion et crée la table
pub fn init_db() -> SqlResult<Connection> {
    let path = get_db_path();
    let conn = Connection::open(path)?;
    
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY,
            peer_ip TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
    "CREATE TABLE IF NOT EXISTS peers (
        ip   TEXT PRIMARY KEY,
        name TEXT NOT NULL
    )",
    [],
)?;
    
    Ok(conn)
}

// Sauvegarde un message
pub fn save_message(
    conn: &Connection, 
    peer_ip: &str, 
    sender_name: &str, 
    content: &str,
    db_key: &[u8; 32], // clé dérivée au démarrage
) -> SqlResult<()> {
    let cipher = Aes256Gcm::new_from_slice(db_key).unwrap();
    let nonce_bytes = rand::random::<[u8; 12]>();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let encrypted = cipher
        .encrypt(nonce, content.as_bytes())
        .unwrap();
    
    let stored = format!(
        "{}:{}",
        general_purpose::STANDARD.encode(&encrypted),
        general_purpose::STANDARD.encode(&nonce_bytes)
    );

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    conn.execute(
        "INSERT INTO messages (peer_ip, sender_name, content, timestamp) 
         VALUES (?1, ?2, ?3, ?4)",
        params![peer_ip, sender_name, stored, timestamp],
    )?;
    Ok(())
}

// Charge l'historique d'un pair
pub fn load_history(
    conn: &Connection, 
    peer_ip: &str,
    db_key: &[u8; 32],
) -> SqlResult<Vec<DbMessage>> {
    let cipher = Aes256Gcm::new_from_slice(db_key).unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT sender_name, content FROM messages 
         WHERE peer_ip = ?1 ORDER BY timestamp ASC"
    )?;

    let msgs = stmt.query_map(params![peer_ip], |row| {
        let sender_name: String = row.get(0)?;
        let stored: String = row.get(1)?;
        
        // Déchiffre
        let parts: Vec<&str> = stored.split(':').collect();
        let content = if parts.len() == 2 {
            let ciphertext = general_purpose::STANDARD
                .decode(parts[0]).unwrap_or_default();
            let nonce_bytes = general_purpose::STANDARD
                .decode(parts[1]).unwrap_or_default();
            
            if nonce_bytes.len() == 12 {
                let nonce = Nonce::from_slice(&nonce_bytes);
                cipher.decrypt(nonce, ciphertext.as_slice())
                    .map(|b: Vec<u8>| String::from_utf8_lossy(&b).to_string())
                    .unwrap_or_else(|_| "[message illisible]".to_string())
            } else {
                "[message illisible]".to_string()
            }
        } else {
            stored // fallback si ancien message non chiffré
        };

        Ok(DbMessage { sender_name, content })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(msgs)
}

pub fn save_peer(conn: &Connection, ip: &str, name: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO peers (ip, name) VALUES (?1, ?2)
         ON CONFLICT(ip) DO UPDATE SET name = excluded.name",
        params![ip, name],
    )?;
    Ok(())
}

pub fn load_peers(conn: &Connection) -> SqlResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT ip, name FROM peers")?;
    let peers = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(peers)
}