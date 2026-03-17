use std::net::{UdpSocket, TcpListener, TcpStream};
use std::thread;
use std::time::Duration;
use std::io::{Write, BufReader, BufRead};
use std::sync::{Arc, Mutex};
use tauri_plugin_notification::NotificationExt;
mod db;
use db::{init_db, save_message, load_history, save_peer, load_peers, DbMessage};
use rusqlite::Connection;

use std::fs;
use std::path::PathBuf;
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use serde_json;
use x25519_dalek::{StaticSecret, PublicKey};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use rand::rngs::OsRng;
use std::time::Instant;

// ─── Structures ───────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
struct PeerInfo {
    ip: String,
    public_key: PublicKey,
    username: String,
    last_seen: Instant,
}

struct AppState {
    my_secret: StaticSecret,
    my_public_key: PublicKey,
    known_peers: Mutex<Vec<PeerInfo>>,
    my_username: Mutex<String>,
    db: Mutex<Connection>,
    db_key: [u8; 32],
    window_focused: Mutex<bool>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct ChatMessage {
    sender_ip: String,
    sender_name: String,
    content: String,
    msg_id: String,
}

#[derive(Deserialize)]
struct UserConfig {
    username: String,
}

// ─── Config ───────────────────────────────────────────────────────────────────

fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("airgap");
    fs::create_dir_all(&path).ok();
    path.push("user_config.json");
    path
}

fn load_username() -> String {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(path).unwrap_or_default();
        if let Ok(config) = serde_json::from_str::<UserConfig>(&content) {
            return config.username;
        }
    }
    "".to_string()
}

fn derive_db_key() -> [u8; 32] {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "airgap-default".to_string());
    let hostname = hostname.trim();
    let salt = b"airgap-db-key-v1";
    let input = format!("{}{}", hostname, String::from_utf8_lossy(salt));
    use sha2::{Sha256, Digest};
    let hash = Sha256::digest(input.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    let saved_username = load_username();
    let conn = init_db().expect("Impossible d'initialiser la DB");
    let db_key = derive_db_key();

    let state = Arc::new(AppState {
        my_secret: secret,
        my_public_key: public,
        known_peers: Mutex::new(Vec::new()),
        my_username: Mutex::new(saved_username),
        db: Mutex::new(conn),
        db_key,
        window_focused: Mutex::new(true),
    });

    tauri::Builder::default()
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![
            send_message,
            get_username,
            set_username,
            get_history,
            send_typing,
            set_window_focused,
            get_saved_peers,
            get_my_ip
        ])
        .setup(move |app| {
            let app_handle = app.handle();

            // Thread 1 — broadcast UDP
            let state_udp = state.clone();
            thread::spawn(move || {
                start_discovery_broadcast(state_udp);
            });

            // Thread 2 — listener UDP
            let state_listen = state.clone();
            let handle_udp = app_handle.clone();
            thread::spawn(move || {
                start_listener(handle_udp, state_listen);
            });

            // Thread 3 — serveur TCP
            let state_tcp = state.clone();
            let handle_tcp = app_handle.clone();
            thread::spawn(move || {
                start_tcp_server(handle_tcp, state_tcp);
            });

            // Thread 4 — watchdog
            let state_watch = state.clone();
            let handle_watch = app_handle.clone();
            thread::spawn(move || {
                loop {
                    thread::sleep(Duration::from_secs(5));

                    let lost: Vec<String> = {
                        let mut peers = state_watch.known_peers.lock().unwrap();
                        let lost: Vec<String> = peers
                            .iter()
                            .filter(|p| p.last_seen.elapsed().as_secs() > 10)
                            .map(|p| p.ip.clone())
                            .collect();
                        peers.retain(|p| p.last_seen.elapsed().as_secs() <= 10);
                        lost
                    };

                    for ip in lost {
                        println!("Pair perdu: {}", ip);
                        handle_watch.emit("peer-left", ip).unwrap();
                    }
                }
            });

            // Thread 5 — typing listener
            let handle_typing = app_handle.clone();
            thread::spawn(move || {
                start_typing_listener(handle_typing);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}

// ─── Commandes Tauri ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_username(state: tauri::State<Arc<AppState>>) -> String {
    state.my_username.lock().unwrap().clone()
}

#[tauri::command]
fn set_username(name: String, state: tauri::State<Arc<AppState>>) {
    let path = get_config_path();
    let json = format!("{{\"username\": \"{}\"}}", name);
    fs::write(path, json).ok();
    *state.my_username.lock().unwrap() = name;
}

#[tauri::command]
fn get_saved_peers(state: tauri::State<Arc<AppState>>) -> Vec<serde_json::Value> {
    let db = state.db.lock().unwrap();
    load_peers(&db)
        .unwrap_or_default()
        .into_iter()
        .map(|(ip, name)| serde_json::json!({ "ip": ip, "name": name }))
        .collect()
}

#[tauri::command]
fn get_my_ip() -> String {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    socket.connect("8.8.8.8:80").unwrap();
    socket.local_addr().unwrap().ip().to_string()
}

#[tauri::command]
fn get_history(peer_ip: String, state: tauri::State<Arc<AppState>>) -> Vec<DbMessage> {
    let db = state.db.lock().unwrap();
    load_history(&db, &peer_ip, &state.db_key).unwrap_or_default()
}

#[tauri::command]
fn send_typing(peer_ip: String, state: tauri::State<Arc<AppState>>) {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    let username = state.my_username.lock().unwrap().clone();
    let msg = format!("AirGap:Typing:{}", username);
    let addr = format!("{}:4244", peer_ip);
    socket.send_to(msg.as_bytes(), addr).ok();
}

#[tauri::command]
fn set_window_focused(focused: bool, state: tauri::State<Arc<AppState>>) {
    *state.window_focused.lock().unwrap() = focused;
}

// ─── UDP broadcast ────────────────────────────────────────────────────────────

fn start_discovery_broadcast(state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind socket");
    socket.set_broadcast(true).expect("Failed to set broadcast");
    let broadcast_addr = "255.255.255.255:4242";

    loop {
        let pubkey_b64 = general_purpose::STANDARD.encode(state.my_public_key.as_bytes());
        let username = state.my_username.lock().unwrap().clone();
        let message = format!("AirGap:Ping:{}:{}", pubkey_b64, username);
        socket.send_to(message.as_bytes(), broadcast_addr).ok();
        thread::sleep(Duration::from_secs(3));
    }
}

// ─── UDP listener ─────────────────────────────────────────────────────────────

fn start_listener(app_handle: tauri::AppHandle, state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:4242").expect("Failed to bind UDP");
    socket.set_broadcast(true).expect("Failed to set broadcast"); // ← INDISPENSABLE pour recevoir les broadcasts
    let mut buf = [0; 4096];

    loop {
        match socket.recv_from(&mut buf) {
            Ok((amt, src)) => {
                let received = String::from_utf8_lossy(&buf[..amt]);
                println!("UDP reçu de {}: {}", src, received);

                if !received.starts_with("AirGap:Ping:") {
                    continue;
                }

                let parts: Vec<&str> = received.splitn(4, ':').collect();
                println!("Parts: {:?} (len={})", parts, parts.len());

                if parts.len() < 3 {
                    continue;
                }

                // trim() essentiel — évite les \n ou espaces parasites
                let pubkey_b64 = parts[2].trim();
                let peer_username = if parts.len() == 4 {
                    parts[3].trim().to_string()
                } else {
                    "Anonyme".to_string()
                };

                println!("Pubkey b64: {}", pubkey_b64);

                // Décode la clé publique
                let pubkey_bytes = match general_purpose::STANDARD.decode(pubkey_b64) {
                    Ok(bytes) => bytes,
                    Err(_) => {
                        println!("Échec décodage base64 pour: {}", pubkey_b64);
                        continue;
                    }
                };

                println!("Pubkey décodée: {} bytes", pubkey_bytes.len());

                if pubkey_bytes.len() != 32 {
                    continue;
                }

                let pubkey_array: [u8; 32] = pubkey_bytes.try_into().unwrap();
                let their_public = PublicKey::from(pubkey_array);

                // Ignore notre propre broadcast
                if their_public == state.my_public_key {
                    println!("C'est notre propre clé — ignoré");
                    continue;
                }

                let peer_ip = src.ip().to_string();

                let my_ip = get_local_ip();
                if peer_ip == my_ip {
                    println!("Paquet de notre propre IP — ignoré");
                    continue;
                }
                println!("Nouveau pair détecté: {}", peer_ip);

                // Vérifie conflit username — lock séparé libéré avant la suite
                let username_taken = {
                    let peers = state.known_peers.lock().unwrap();
                    peers.iter().any(|p| {
                        p.username == peer_username && p.ip != peer_ip
                    })
                };

                if username_taken {
                    println!("Conflit username: {} ({})", peer_username, peer_ip);
                    app_handle.emit(
                        "username-conflict",
                        serde_json::json!({
                            "ip": peer_ip,
                            "name": peer_username
                        }).to_string(),
                    ).unwrap();
                    continue;
                }

                // Met à jour known_peers
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

                // Notifie le frontend
                let payload = serde_json::json!({
                    "ip": peer_ip,
                    "name": peer_username
                });
                app_handle.emit("peer-found", payload.to_string()).unwrap();

                // Sauvegarde en DB
                {
                    let db = state.db.lock().unwrap();
                    save_peer(&db, &peer_ip, &peer_username).ok();
                }
            }
            Err(e) => println!("Erreur UDP: {}", e),
        }
    }
}

fn get_local_ip() -> String {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    socket.connect("8.8.8.8:80").unwrap();
    socket.local_addr().unwrap().ip().to_string()
}
// ─── TCP server ───────────────────────────────────────────────────────────────

fn start_tcp_server(app_handle: tauri::AppHandle, state: Arc<AppState>) {
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

fn handle_tcp_connection(stream: TcpStream, app_handle: tauri::AppHandle, state: Arc<AppState>) {
    let sender_addr = stream.peer_addr().unwrap().ip().to_string();
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();

    if reader.read_line(&mut line).is_ok() {
        let line = line.trim();
        let parts: Vec<&str> = line.splitn(4, ':').collect();

        match parts[0] {
            "MSG" if parts.len() == 4 => {
                let msg_id     = parts[1];
                let cipher_b64 = parts[2];
                let nonce_b64  = parts[3];

                let peer_data = {
                    let peers = state.known_peers.lock().unwrap();
                    peers.iter().find(|p| p.ip == sender_addr).map(|peer| {
                        (peer.public_key.clone(), peer.username.clone())
                    })
                };

                if let Some((peer_pubkey, peer_username)) = peer_data {
                    let shared_secret = state.my_secret.diffie_hellman(&peer_pubkey);
                    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();

                    let ciphertext  = general_purpose::STANDARD.decode(cipher_b64).unwrap_or_default();
                    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64).unwrap_or_default();

                    if nonce_bytes.len() == 12 {
                        let nonce = Nonce::from_slice(&nonce_bytes);
                        if let Ok(decrypted) = cipher.decrypt(nonce, ciphertext.as_slice()) {
                            let content = String::from_utf8_lossy(&decrypted).to_string();

                            {
                                let db = state.db.lock().unwrap();
                                save_message(&db, &sender_addr, &peer_username, &content, &state.db_key).ok();
                            }

                            let msg = ChatMessage {
                                sender_ip:   sender_addr.clone(),
                                sender_name: peer_username.clone(),
                                content:     content.clone(),
                                msg_id:      msg_id.to_string(),
                            };
                            app_handle.emit("message-received", msg).unwrap();

                            let is_focused = *state.window_focused.lock().unwrap();
                            if !is_focused {
                                app_handle
                                    .notification()
                                    .builder()
                                    .title(&peer_username)
                                    .body(&content)
                                    .show()
                                    .ok();
                            }

                            if let Ok(mut ack_stream) = TcpStream::connect(
                                format!("{}:4243", sender_addr)
                            ) {
                                let ack = format!("ACK:{}\n", msg_id);
                                ack_stream.write_all(ack.as_bytes()).ok();
                            }
                        }
                    }
                }
            }

            "ACK" if parts.len() >= 2 => {
                let msg_id = parts[1].to_string();
                app_handle.emit("message-ack", msg_id).unwrap();
            }

            _ => println!("Format inconnu: {}", line),
        }
    }
}

// ─── send_message ─────────────────────────────────────────────────────────────

#[tauri::command]
fn send_message(
    peer_ip: String,
    content: String,
    msg_id: String,
    state: tauri::State<Arc<AppState>>,
) -> Result<(), String> {
    let peer_pubkey = {
        let peers = state.known_peers.lock().unwrap();
        peers.iter().find(|p| p.ip == peer_ip)
            .map(|p| p.public_key.clone())
            .ok_or("Destinataire inconnu".to_string())?
    };

    let shared_secret = state.my_secret.diffie_hellman(&peer_pubkey);
    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();
    let nonce_bytes = rand::random::<[u8; 12]>();
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
    save_message(&db, &peer_ip, &username, &content, &state.db_key).ok();

    Ok(())
}

// ─── Typing listener ─────────────────────────────────────────────────────────

fn start_typing_listener(app_handle: tauri::AppHandle) {
    let socket = UdpSocket::bind("0.0.0.0:4244").expect("Failed to bind typing UDP");
    let mut buf = [0; 512];

    loop {
        if let Ok((amt, src)) = socket.recv_from(&mut buf) {
            let received = String::from_utf8_lossy(&buf[..amt]);
            if received.starts_with("AirGap:Typing:") {
                let parts: Vec<&str> = received.splitn(3, ':').collect();
                if parts.len() == 3 {
                    let payload = serde_json::json!({
                        "ip": src.ip().to_string(),
                        "name": parts[2].trim()
                    });
                    app_handle.emit("peer-typing", payload.to_string()).unwrap();
                }
            }
        }
    }
}