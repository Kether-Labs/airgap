use std::io::Write;
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use rand::random;
use tauri::State;

use crate::state::AppState;

pub fn send_message(
    peer_ip: String,
    content: String,
    msg_id: String,
    state: State<Arc<AppState>>,
) -> Result<(), String> {
    let peer_pubkey = {
        let peers = state.known_peers.lock().unwrap();
        peers.iter().find(|p| p.ip == peer_ip)
            .map(|p| p.public_key.clone())
            .ok_or("Destinataire inconnu".to_string())?
    };

    let shared_secret = state.my_secret.diffie_hellman(&peer_pubkey);
    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();
    let nonce_bytes = random::<[u8; 12]>();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, content.as_bytes()).map_err(|e| e.to_string())?;

    let line = format!(
        "MSG:{}:{}:{}\n",
        msg_id,
        general_purpose::STANDARD.encode(&ciphertext),
        general_purpose::STANDARD.encode(&nonce_bytes)
    );

    let addr = format!("{}:4243", peer_ip);
    let stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e: std::net::AddrParseError| e.to_string())?,
        Duration::from_secs(5),
    ).map_err(|e| e.to_string())?;

    let mut stream = stream;
    stream.write_all(line.as_bytes()).map_err(|e| e.to_string())?;

    let username = state.my_username.lock().unwrap().clone();
    let db = state.db.lock().unwrap();
    crate::db::save_message(&db, &peer_ip, &username, &content, &state.db_key, None, None, None).ok();

    Ok(())
}