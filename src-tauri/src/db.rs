// src-tauri/src/db.rs

use rusqlite::{Connection, Result as SqlResult, params};
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

use base64::{Engine as _, engine::general_purpose};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use rand::random;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DbMessage {
    pub sender_name: String,
    pub content: String,
    pub media_data: Option<String>,
    pub media_type: Option<String>,
    pub thumbnail: Option<String>,
}

fn get_db_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("airgap");
    fs::create_dir_all(&path).ok();
    path.push("airgap.db");
    path
}

pub fn init_db() -> SqlResult<Connection> {
    let path = get_db_path();
    let conn = Connection::open(path)?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY,
            peer_ip TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            content TEXT NOT NULL,
            media_data TEXT,
            media_type TEXT,
            thumbnail TEXT,
            timestamp INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS peers (
            ip   TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            last_seen INTEGER NOT NULL
        )",
        [],
    )?;
    
    Ok(conn)
}

pub fn save_message(
    conn: &Connection, 
    peer_ip: &str, 
    sender_name: &str, 
    content: &str,
    db_key: &[u8; 32],
    media_data: Option<&[u8]>,
    media_type: Option<&str>,
    thumbnail: Option<&[u8]>,
) -> SqlResult<()> {
    let media_b64 = media_data.map(|d| general_purpose::STANDARD.encode(d));
    let thumb_b64 = thumbnail.map(|t| general_purpose::STANDARD.encode(t));
    
    println!("[DB] save: peer={}, content={}, media={:?}, thumb={:?}", 
        peer_ip, content, media_b64.is_some(), thumb_b64.is_some());
    
    let cipher = Aes256Gcm::new_from_slice(db_key).unwrap();
    let nonce_bytes = random::<[u8; 12]>();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let encrypted = cipher.encrypt(nonce, content.as_bytes()).unwrap();
    
    let stored = format!(
        "{}:{}",
        general_purpose::STANDARD.encode(&encrypted),
        general_purpose::STANDARD.encode(&nonce_bytes)
    );

    let media_b64 = media_data.map(|d| general_purpose::STANDARD.encode(d));
    let thumb_b64 = thumbnail.map(|t| general_purpose::STANDARD.encode(t));

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    conn.execute(
        "INSERT INTO messages (peer_ip, sender_name, content, media_data, media_type, thumbnail, timestamp) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![peer_ip, sender_name, stored, media_b64, media_type, thumb_b64, timestamp],
    )?;
    Ok(())
}

pub fn load_history(
    conn: &Connection, 
    peer_ip: &str,
    db_key: &[u8; 32],
) -> SqlResult<Vec<DbMessage>> {
    let cipher = Aes256Gcm::new_from_slice(db_key).unwrap();
    
    // Debug: count total messages for this peer
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM messages WHERE peer_ip = ?1",
        params![peer_ip],
        |row| row.get(0)
    ).unwrap_or(0);
    
    println!("[DEBUG] Total messages for {}: {}", peer_ip, count);
    
    let mut stmt = conn.prepare(
        "SELECT sender_name, content, media_data, media_type, thumbnail FROM messages 
         WHERE peer_ip = ?1 ORDER BY timestamp ASC"
    )?;

    let msgs = stmt.query_map(params![peer_ip], |row| {
        let sender_name: String = row.get(0)?;
        let stored: String = row.get(1)?;
        let media_b64: Option<String> = row.get(2)?;
        let media_type: Option<String> = row.get(3)?;
        let thumb_b64: Option<String> = row.get(4)?;
        
        let parts: Vec<&str> = stored.split(':').collect();
        let content = if parts.len() == 2 {
            let ciphertext = general_purpose::STANDARD.decode(parts[0]).unwrap_or_default();
            let nonce_bytes = general_purpose::STANDARD.decode(parts[1]).unwrap_or_default();
            
            if nonce_bytes.len() == 12 {
                let nonce = Nonce::from_slice(&nonce_bytes);
                cipher.decrypt(nonce, ciphertext.as_slice())
                    .map(|b: Vec<u8>| String::from_utf8_lossy(&b).to_string())
                    .unwrap_or_else(|_| "[message illisible]".to_string())
            } else {
                "[message illisible]".to_string()
            }
        } else {
            stored
        };

        Ok(DbMessage { 
            sender_name, 
            content,
            media_data: media_b64,
            media_type,
            thumbnail: thumb_b64,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(msgs)
}

pub fn debug_count(conn: &Connection, peer_ip: &str) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM messages WHERE peer_ip = ?1",
        [peer_ip],
        |row| row.get(0)
    ).unwrap_or(0)
}

pub fn save_peer(conn: &Connection, ip: &str, name: &str) -> SqlResult<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    conn.execute(
        "INSERT INTO peers (ip, name, last_seen) VALUES (?1, ?2, ?3)
         ON CONFLICT(ip) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen",
        params![ip, name, now],
    )?;
    Ok(())
}

pub fn load_peers(conn: &Connection) -> SqlResult<Vec<(String, String)>> {
    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() - (7 * 24 * 3600);
    
    let mut stmt = conn.prepare(
        "SELECT ip, name FROM peers WHERE last_seen > ?1 ORDER BY last_seen DESC"
    )?;
    
    let peers = stmt.query_map(params![cutoff], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })?.collect::<Result<Vec<_>, _>>()?;
    
    Ok(peers)
}