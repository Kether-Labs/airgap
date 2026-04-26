use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use tauri::Emitter;

use crate::db;
use crate::notification;
use crate::state::{AppState, ChatMessage};

pub fn start_tcp_server(app_handle: tauri::AppHandle, state: std::sync::Arc<AppState>) {
    let listener = TcpListener::bind("0.0.0.0:4243").expect("Failed to bind TCP");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let handle = app_handle.clone();
                let state_clone = state.clone();
                thread::spawn(move || {
                    handle_tcp_connection(stream, handle, state_clone);
                });
            }
            Err(e) => println!("Erreur TCP: {}", e),
        }
    }
}

fn handle_tcp_connection(
    stream: TcpStream,
    app_handle: tauri::AppHandle,
    state: std::sync::Arc<AppState>,
) {
    let sender_addr = match stream.peer_addr() {
        Ok(addr) => addr.ip().to_string(),
        Err(e) => {
            println!("Impossible de récupérer l'adresse du pair: {}", e);
            return;
        }
    };

    let mut reader = BufReader::new(&stream);
    let mut line = String::new();

    if reader.read_line(&mut line).is_ok() {
        let line = line.trim();
        let parts: Vec<&str> = line.splitn(4, ':').collect();

        match parts[0] {
            "MSG" if parts.len() == 4 => {
                let msg_id = parts[1];
                let cipher_b64 = parts[2];
                let nonce_b64 = parts[3];

                let peer_data = {
                    let peers = state.known_peers.lock().unwrap();
                    peers.iter().find(|p| p.ip == sender_addr).map(|peer| {
                        (peer.public_key.clone(), peer.username.clone())
                    })
                };

                if let Some((peer_pubkey, peer_username)) = peer_data {
                    let shared_secret = state.my_secret.diffie_hellman(&peer_pubkey);
                    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();

                    let ciphertext = general_purpose::STANDARD.decode(cipher_b64).unwrap_or_default();
                    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64).unwrap_or_default();

                    if nonce_bytes.len() == 12 {
                        let nonce = Nonce::from_slice(&nonce_bytes);
                        if let Ok(decrypted) = cipher.decrypt(nonce, ciphertext.as_ref()) {
                            let content = String::from_utf8_lossy(&decrypted).to_string();

                            {
                                let db = state.db.lock().unwrap();
                                db::save_message(&db, &sender_addr, &peer_username, &content, &state.db_key, None, None, None).ok();
                            }

                            let msg = ChatMessage {
                                sender_ip: sender_addr.clone(),
                                sender_name: peer_username.clone(),
                                content: content.clone(),
                                msg_id: msg_id.to_string(),
                            };
                            let _ = app_handle.emit("message-received", msg);

                            let is_focused = *state.window_focused.lock().unwrap();
                            let active_peer = state.active_peer_ip.lock().unwrap().clone();
                            let is_active_conversation = active_peer == sender_addr;
                            let should_notify = !is_focused || !is_active_conversation;

                            if should_notify {
                                notification::show_custom_notification(
                                    &app_handle,
                                    &peer_username,
                                    &content,
                                    &sender_addr,
                                );
                            }

                            if let Ok(mut ack_stream) = TcpStream::connect(format!("{}:4243", sender_addr)) {
                                let ack = format!("ACK:{}\n", msg_id);
                                ack_stream.write_all(ack.as_bytes()).ok();
                            }
                        }
                    }
                }
            }

            "ACK" if parts.len() >= 2 => {
                let msg_id = parts[1].to_string();
                let _ = app_handle.emit("message-ack", msg_id);
            }

            "MEDIA" if parts.len() >= 5 => {
                let msg_id = parts[1];
                let media_type = parts[2];
                let cipher_b64 = parts[3];
                let nonce_b64 = parts[4];
                let thumb_b64 = if parts.len() > 5 { parts[5] } else { "" };

                let peer_data = {
                    let peers = state.known_peers.lock().unwrap();
                    peers.iter().find(|p| p.ip == sender_addr).map(|peer| {
                        (peer.public_key.clone(), peer.username.clone())
                    })
                };

                if let Some((peer_pubkey, peer_username)) = peer_data {
                    let shared_secret = state.my_secret.diffie_hellman(&peer_pubkey);
                    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();

                    let ciphertext = general_purpose::STANDARD.decode(cipher_b64).unwrap_or_default();
                    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64).unwrap_or_default();

                    if nonce_bytes.len() == 12 {
                        let nonce = Nonce::from_slice(&nonce_bytes);
                        if let Ok(image_data) = cipher.decrypt(nonce, ciphertext.as_ref()) {
                            let thumbnail = if !thumb_b64.is_empty() {
                                general_purpose::STANDARD.decode(thumb_b64).ok()
                            } else {
                                None
                            };

                            // Décoder la caption si présente (champ 6)
                            let caption = if parts.len() > 6 && !parts[6].is_empty() {
                                let caption_bytes = general_purpose::STANDARD.decode(parts[6]).ok();
                                caption_bytes.and_then(|b| String::from_utf8(b).ok())
                            } else {
                                None
                            };
                            
                            let media_content = match caption {
                                Some(ref c) if !c.is_empty() => format!("[{}] {}", media_type, c),
                                _ => format!("[{}]", media_type),
                            };

                            {
                                let db = state.db.lock().unwrap();
                                db::save_message(
                                    &db, 
                                    &sender_addr, 
                                    &peer_username, 
                                    &media_content, 
                                    &state.db_key, 
                                    Some(&image_data),
                                    Some(&media_type),
                                    thumbnail.as_deref()
                                ).ok();
                            }

                            let msg = ChatMessage {
                                sender_ip: sender_addr.clone(),
                                sender_name: peer_username.clone(),
                                content: media_content,
                                msg_id: msg_id.to_string(),
                            };
                            let _ = app_handle.emit("media-received", serde_json::json!({
                                "message": msg,
                                "data": general_purpose::STANDARD.encode(&image_data),
                                "media_type": media_type,
                                "thumbnail": thumbnail.map(|t| general_purpose::STANDARD.encode(t))
                            }));

                            if let Ok(mut ack_stream) = TcpStream::connect(format!("{}:4243", sender_addr)) {
                                let ack = format!("ACK:{}\n", msg_id);
                                ack_stream.write_all(ack.as_bytes()).ok();
                            }
                        }
                    }
                }
            }

            _ => println!("Format inconnu: {}", line),
        }
    }
}