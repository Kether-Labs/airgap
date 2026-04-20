use std::sync::Mutex;
use std::time::Instant;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::config;
use crate::db;

#[derive(Clone, Debug)]
pub struct PeerInfo {
    pub ip: String,
    pub public_key: PublicKey,
    pub username: String,
    pub last_seen: Instant,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ChatMessage {
    pub sender_ip: String,
    pub sender_name: String,
    pub content: String,
    pub msg_id: String,
}

#[derive(Deserialize)]
pub struct UserConfig {
    pub username: String,
}

pub struct AppState {
    pub my_secret: StaticSecret,
    pub my_public_key: PublicKey,
    pub known_peers: Mutex<Vec<PeerInfo>>,
    pub my_username: Mutex<String>,
    pub db: Mutex<Connection>,
    pub db_key: [u8; 32],
    pub window_focused: Mutex<bool>,
    pub active_peer_ip: Mutex<String>,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        let secret = StaticSecret::random_from_rng(rand::rngs::OsRng);
        let public = PublicKey::from(&secret);
        let saved_username = config::load_username().map_err(|e| e.to_string())?;
        let conn = db::init_db().map_err(|e| e.to_string())?;
        let db_key = config::derive_db_key();

        Ok(Self {
            my_secret: secret,
            my_public_key: public,
            known_peers: Mutex::new(Vec::new()),
            my_username: Mutex::new(saved_username),
            db: Mutex::new(conn),
            db_key,
            window_focused: Mutex::new(true),
            active_peer_ip: Mutex::new(String::new()),
        })
    }
}