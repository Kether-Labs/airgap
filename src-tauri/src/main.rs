use std::net::{UdpSocket, TcpListener, TcpStream};
use std::thread;
use std::time::Duration;
use std::io::{Read, Write, BufReader, BufRead};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use serde::{Deserialize, Serialize};
// Import correct pour x25519
use x25519_dalek::{StaticSecret, PublicKey};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
// CORRECTION DU TYPO ICI
use base64::{Engine as _, engine::general_purpose};
use rand::rngs::OsRng;

#[derive(Clone, Debug)]
struct PeerInfo {
    ip: String,
    public_key: PublicKey,
}

struct AppState {
    my_secret: StaticSecret,
    my_public_key: PublicKey,
    known_peers: Mutex<Vec<PeerInfo>>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct ChatMessage {
    sender_ip: String,
    content: String,
}

fn main() {
    // Génération des clés statiques
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    
    println!("Clé publique générée : {}", general_purpose::STANDARD.encode(public.as_bytes()));

    let state = Arc::new(AppState {
        my_secret: secret,
        my_public_key: public,
        known_peers: Mutex::new(Vec::new()),
    });

    tauri::Builder::default()
        .manage(state.clone())
        .setup(move |app| {
            // CORRECTION WARNING: on utilise la variable tout de suite pour les clones
            let app_handle = app.handle();

            let state_udp = state.clone();
            thread::spawn(move || {
                start_discovery_broadcast(state_udp);
            });

            let state_listen = state.clone();
            let handle_udp = app_handle.clone(); // Utilisation du clone
            thread::spawn(move || {
                start_listener(handle_udp, state_listen);
            });

            let state_tcp = state.clone();
            let handle_tcp = app_handle.clone(); // Utilisation du clone
            thread::spawn(move || {
                start_tcp_server(handle_tcp, state_tcp);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![send_message])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}

fn start_discovery_broadcast(state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind socket");
    socket.set_broadcast(true).expect("Failed to set broadcast");
    let broadcast_addr = "255.255.255.255:4242";
    
    let pubkey_b64 = general_purpose::STANDARD.encode(state.my_public_key.as_bytes());
    let message = format!("AirGap:Ping:{}", pubkey_b64);

    loop {
        socket.send_to(message.as_bytes(), broadcast_addr).expect("Failed to send");
        thread::sleep(Duration::from_secs(5));
    }
}

fn start_listener(app_handle: tauri::AppHandle, state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:4242").expect("Failed to bind UDP");
    let mut buf = [0; 2048]; 

    loop {
        match socket.recv_from(&mut buf) {
            Ok((amt, src)) => {
                let received = String::from_utf8_lossy(&buf[..amt]);
                
                if received.starts_with("AirGap:Ping:") {
                    let parts: Vec<&str> = received.splitn(3, ':').collect();
                    if parts.len() == 3 {
                        let pubkey_b64 = parts[2];
                        
                        if let Ok(pubkey_bytes) = general_purpose::STANDARD.decode(pubkey_b64) {
                            if pubkey_bytes.len() == 32 {
                                let pubkey_array: [u8; 32] = pubkey_bytes.try_into().unwrap();
                                let their_public = PublicKey::from(pubkey_array);
                                //if their_public == state.my_public_key {
                                    //continue; 
                                //}
                                let peer_ip = src.ip().to_string();
                                
                                {
                                    let mut peers = state.known_peers.lock().unwrap();
                                    if let Some(peer) = peers.iter_mut().find(|p| p.ip == peer_ip) {
                                        peer.public_key = their_public;
                                    } else {
                                        peers.push(PeerInfo { ip: peer_ip.clone(), public_key: their_public });
                                    }
                                }
                                
                                app_handle.emit("peer-found", peer_ip).unwrap();
                            }
                        }
                    }
                }
            },
            Err(e) => println!("Erreur UDP: {}", e),
        }
    }
}

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
            },
            Err(e) => println!("Erreur TCP: {}", e),
        }
    }
}

fn handle_tcp_connection(stream: TcpStream, app_handle: tauri::AppHandle, state: Arc<AppState>) {
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();

    if reader.read_line(&mut line).is_ok() {
        let sender_addr = stream.peer_addr().unwrap().ip().to_string();
        
        let peers = state.known_peers.lock().unwrap();
        let peer_info = peers.iter().find(|p| p.ip == sender_addr);
        
        if let Some(peer) = peer_info {
            // Cela compile maintenant grâce à "static_secrets" dans Cargo.toml
            let shared_secret = state.my_secret.diffie_hellman(&peer.public_key);
            
            let parts: Vec<&str> = line.trim().split(':').collect();
            if parts.len() == 2 {
                let ciphertext = general_purpose::STANDARD.decode(parts[0]).unwrap_or_default();
                let nonce_bytes = general_purpose::STANDARD.decode(parts[1]).unwrap_or_default();
                
                if nonce_bytes.len() == 12 {
                    let nonce = Nonce::from_slice(&nonce_bytes);
                    let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();
                    
                    match cipher.decrypt(nonce, ciphertext.as_slice()) {
                        Ok(decrypted) => {
                            let msg = ChatMessage {
                                sender_ip: sender_addr,
                                content: String::from_utf8_lossy(&decrypted).to_string(),
                            };
                            app_handle.emit("message-received", msg).unwrap();
                        },
                        Err(_) => println!("Erreur de déchiffrement"),
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn send_message(peer_ip: String, content: String, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    let peers = state.known_peers.lock().unwrap();
    let peer_info = peers.iter().find(|p| p.ip == peer_ip);
    
    if let Some(peer) = peer_info {
        let shared_secret = state.my_secret.diffie_hellman(&peer.public_key);
        let cipher = Aes256Gcm::new_from_slice(shared_secret.as_bytes()).unwrap();
        
        let nonce_bytes = rand::random::<[u8; 12]>();
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, content.as_bytes()).map_err(|e| e.to_string())?;
        
        let encrypted_msg = format!("{}:{}", 
            general_purpose::STANDARD.encode(&ciphertext), 
            general_purpose::STANDARD.encode(&nonce_bytes)
        );
        
        let addr = format!("{}:4243", peer_ip);
        let mut stream = TcpStream::connect(&addr).map_err(|e| e.to_string())?;
        stream.write_all(format!("{}\n", encrypted_msg).as_bytes()).map_err(|e| e.to_string())?;
        
        Ok(())
    } else {
        Err("Destinataire inconnu".to_string())
    }
}