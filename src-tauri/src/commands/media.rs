use std::io::Write;
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use rand::random;
use tauri::State;

use crate::state::AppState;
use crate::db;

pub fn send_media(
    peer_ip: String,
    image_data: Vec<u8>,
    media_type: String,
    msg_id: String,
    thumbnail: Option<Vec<u8>>,
    caption: Option<String>,
    state: State<Arc<AppState>>,
) -> Result<(), String> {
    // Debug
    println!("[MEDIA] send_media: image_len={}, thumb_len={}", 
        image_data.len(), thumbnail.as_ref().map(|t| t.len()).unwrap_or(0));
    
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
    let ciphertext = cipher.encrypt(nonce, image_data.as_slice()).map_err(|e| e.to_string())?;

    let media_b64 = general_purpose::STANDARD.encode(&ciphertext);
    let nonce_b64 = general_purpose::STANDARD.encode(&nonce_bytes);
    
    let thumbnail_b64 = thumbnail.as_ref()
        .map(|t| general_purpose::STANDARD.encode(t))
        .unwrap_or_default();

    let caption_b64 = caption.as_ref()
        .map(|c| general_purpose::STANDARD.encode(c.as_bytes()))
        .unwrap_or_default();

    let line = format!(
        "MEDIA:{}:{}:{}:{}:{}:{}\n",
        msg_id,
        media_type,
        media_b64,
        nonce_b64,
        thumbnail_b64,
        caption_b64
    );

    let addr = format!("{}:4243", peer_ip);
    let stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e: std::net::AddrParseError| e.to_string())?,
        Duration::from_secs(10),
    ).map_err(|e| e.to_string())?;

    let mut stream = stream;
    stream.write_all(line.as_bytes()).map_err(|e| e.to_string())?;

    let username = state.my_username.lock().unwrap().clone();
    let db = state.db.lock().unwrap();
    let content = match caption {
        Some(ref c) if !c.is_empty() => format!("[{}] {}", media_type, c),
        _ => format!("[{}]", media_type),
    };
    
    println!("[DEBUG] Saving media to DB: content={}, media_data_len={}, thumb_len={}", 
        content, image_data.len(), thumbnail.as_ref().map(|t| t.len()).unwrap_or(0));

    let thumb_ref: Option<&[u8]> = thumbnail.as_ref().map(|v| v.as_slice());
    let _ = db::save_message(&db, &peer_ip, &username, &content, &state.db_key, Some(&image_data), Some(&media_type), thumb_ref);

    Ok(())
    }