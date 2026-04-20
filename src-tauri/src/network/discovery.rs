use std::net::UdpSocket;
use std::thread;
use std::time::{Duration, Instant};

use base64::{Engine as _, engine::general_purpose};
use tauri::Emitter;
use x25519_dalek::PublicKey;

use crate::state::{AppState, PeerInfo};

fn get_local_ip() -> String {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    socket.connect("8.8.8.8:80").unwrap();
    socket.local_addr().unwrap().ip().to_string()
}

pub fn start_discovery_broadcast(state: std::sync::Arc<AppState>) {
    loop {
        let local_ip = get_local_ip();

        if let Ok(socket) = UdpSocket::bind(format!("{}:0", local_ip)) {
            socket.set_broadcast(true).unwrap_or(());
            let pubkey_b64 = general_purpose::STANDARD.encode(state.my_public_key.as_bytes());
            let username = state.my_username.lock().unwrap().clone();
            let message = format!("AirGap:Ping:{}:{}", pubkey_b64, username);

            socket.send_to(message.as_bytes(), "255.255.255.255:4242").ok();
        }

        thread::sleep(Duration::from_secs(3));
    }
}

pub fn start_listener(app_handle: tauri::AppHandle, state: std::sync::Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:4242").expect("Failed to bind UDP");
    socket.set_broadcast(true).expect("Failed to set broadcast");
    let mut buf = [0; 4096];

    println!("Listener UDP démarré sur 0.0.0.0:4242");

    loop {
        match socket.recv_from(&mut buf) {
            Ok((amt, src)) => {
                let received = String::from_utf8_lossy(&buf[..amt]);
                println!("UDP reçu de {}: {}", src, received);

                if !received.starts_with("AirGap:Ping:") {
                    continue;
                }

                let parts: Vec<&str> = received.splitn(4, ':').collect();
                if parts.len() < 3 {
                    continue;
                }

                let pubkey_b64 = parts[2].trim();
                let peer_username = if parts.len() == 4 {
                    parts[3].trim().to_string()
                } else {
                    "Anonyme".to_string()
                };

                let pubkey_bytes = match general_purpose::STANDARD.decode(pubkey_b64) {
                    Ok(bytes) => bytes,
                    Err(_) => continue,
                };

                if pubkey_bytes.len() != 32 {
                    continue;
                }

                let pubkey_array: [u8; 32] = pubkey_bytes.try_into().unwrap();
                let their_public = PublicKey::from(pubkey_array);

                if their_public == state.my_public_key {
                    continue;
                }

                let peer_ip = src.ip().to_string();
                let my_ip = get_local_ip();
                if peer_ip == my_ip {
                    continue;
                }

                let my_username = state.my_username.lock().unwrap().clone();
                if !my_username.is_empty() && peer_username == my_username {
                    let _ = app_handle.emit(
                        "username-conflict",
                        serde_json::json!({
                            "ip": peer_ip,
                            "name": peer_username
                        }).to_string(),
                    );
                    continue;
                }

                let username_taken = {
                    let peers = state.known_peers.lock().unwrap();
                    peers.iter().any(|p| p.username == peer_username && p.ip != peer_ip)
                };

                if username_taken {
                    let _ = app_handle.emit(
                        "username-conflict",
                        serde_json::json!({
                            "ip": peer_ip,
                            "name": peer_username
                        }).to_string(),
                    );
                    continue;
                }

                {
                    let mut peers = state.known_peers.lock().unwrap();
                    if let Some(peer) = peers.iter_mut().find(|p| p.ip == peer_ip) {
                        peer.public_key = their_public;
                        peer.username = peer_username.clone();
                        peer.last_seen = Instant::now();
                    } else {
                        peers.push(PeerInfo {
                            ip: peer_ip.clone(),
                            public_key: their_public,
                            username: peer_username.clone(),
                            last_seen: Instant::now(),
                        });
                    }
                }

                let _ = app_handle.emit(
                    "peer-found",
                    serde_json::json!({
                        "ip": peer_ip,
                        "name": peer_username
                    }).to_string(),
                );

                {
                    let db = state.db.lock().unwrap();
                    crate::db::save_peer(&db, &peer_ip, &peer_username).ok();
                }
            }
            Err(e) => println!("Erreur UDP: {}", e),
        }
    }
}