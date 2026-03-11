use std::net::{UdpSocket, TcpListener, TcpStream};
use std::thread;
use std::time::Duration;
use std::io::{Write, BufReader, BufRead};
use std::sync::{Arc, Mutex};

use std::fs;
use std::path::PathBuf;
use tauri::Emitter; // INDISPENSABLE pour Tauri v2 (mais on le garde si tu es en mixte)
use serde::{Deserialize, Serialize};
use serde_json;
use x25519_dalek::{StaticSecret, PublicKey};
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use rand::rngs::OsRng;

// Structure des données d'un pair
#[derive(Clone, Debug)]
struct PeerInfo {
    ip: String,
    public_key: PublicKey,
    username: String, // Nouveau : on stocke le pseudo
}

// État global
struct AppState {
    my_secret: StaticSecret,
    my_public_key: PublicKey,
    known_peers: Mutex<Vec<PeerInfo>>,
    my_username: Mutex<String>, // Nouveau : ton pseudo actuel
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct ChatMessage {
    sender_ip: String,
    sender_name: String, // Nouveau
    content: String,
}

// Fonction pour obtenir le chemin du fichier de config
fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("airgap");
    fs::create_dir_all(&path).ok();
    path.push("user_config.json");
    path
}

fn main() {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);

    // Chargement du pseudo sauvegardé
    let saved_username = load_username();

    let state = Arc::new(AppState {
        my_secret: secret,
        my_public_key: public,
        known_peers: Mutex::new(Vec::new()),
        my_username: Mutex::new(saved_username),
    });

    tauri::Builder::default()
        .manage(state.clone())
        .setup(move |app| {
            let app_handle = app.handle();

            // On lance juste les threads réseaux, pas de création de fenêtre ici.
            // React gèrera l'affichage du formulaire ou du chat.

            let state_udp = state.clone();
            thread::spawn(move || {
                start_discovery_broadcast(state_udp);
            });

            let state_listen = state.clone();
            let handle_udp = app_handle.clone();
            thread::spawn(move || {
                start_listener(handle_udp, state_listen);
            });

            let state_tcp = state.clone();
            let handle_tcp = app_handle.clone();
            thread::spawn(move || {
                start_tcp_server(handle_tcp, state_tcp);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![send_message, get_username, set_username])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}

// --- COMMANDES POUR LE FRONTEND ---

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

#[derive(Deserialize)]
struct UserConfig {
    username: String,
}
fn load_username() -> String {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(path).unwrap_or_default();
        // On essaie de parser le JSON proprement
        if let Ok(config) = serde_json::from_str::<UserConfig>(&content) {
            return config.username;
        }
    }
    // Si le fichier n'existe pas ou est invalide, on retourne vide
    "".to_string()
}

// --- RESEAU (Modifié pour envoyer/recevoir le pseudo) ---

fn start_discovery_broadcast(state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind socket");
    socket.set_broadcast(true).expect("Failed to set broadcast");
    let broadcast_addr = "255.255.255.255:4242";

    loop {
        let pubkey_b64 = general_purpose::STANDARD.encode(state.my_public_key.as_bytes());
        let username = state.my_username.lock().unwrap().clone();
        
        // Format: "AirGap:Ping:CLE_PUB:USERNAME"
        let message = format!("AirGap:Ping:{}:{}", pubkey_b64, username);

        socket.send_to(message.as_bytes(), broadcast_addr).expect("Failed to send");
        thread::sleep(Duration::from_secs(5));
    }
}

fn start_listener(app_handle: tauri::AppHandle, state: Arc<AppState>) {
    let socket = UdpSocket::bind("0.0.0.0:4242").expect("Failed to bind UDP");
    let mut buf = [0; 4096]; // Buffer plus grand pour le pseudo

    loop {
        match socket.recv_from(&mut buf) {
            Ok((amt, src)) => {
                let received = String::from_utf8_lossy(&buf[..amt]);
                
                if received.starts_with("AirGap:Ping:") {
                    let parts: Vec<&str> = received.splitn(4, ':').collect(); // Divise en 4 max
                    if parts.len() >= 3 { // Au minimum Ping:Cle
                        let pubkey_b64 = parts[2];
                        let peer_username = if parts.len() == 4 { parts[3].to_string() } else { "Anonyme".to_string() };
                        
                        if let Ok(pubkey_bytes) = general_purpose::STANDARD.decode(pubkey_b64) {
                            if pubkey_bytes.len() == 32 {
                                let pubkey_array: [u8; 32] = pubkey_bytes.try_into().unwrap();
                                let their_public = PublicKey::from(pubkey_array);

                                if their_public == state.my_public_key { continue; }

                                let peer_ip = src.ip().to_string();
                                
                                {
                                    let mut peers = state.known_peers.lock().unwrap();
                                    if let Some(peer) = peers.iter_mut().find(|p| p.ip == peer_ip) {
                                        peer.public_key = their_public;
                                        peer.username = peer_username.clone();
                                    } else {
                                        peers.push(PeerInfo { 
                                            ip: peer_ip.clone(), 
                                            public_key: their_public,
                                            username: peer_username.clone()
                                        });
                                    }
                                }
                                
                                // On envoie un objet JSON au frontend maintenant
                                let payload = serde_json::json!({"ip": peer_ip, "name": peer_username});
                                app_handle.emit("peer-found", payload.to_string()).unwrap();
                            }
                        }
                    }
                }
            },
            Err(e) => println!("Erreur UDP: {}", e),
        }
    }
}

// ... (TCP SERVER ET HANDLE_TCP_CONNECTION et SEND_MESSAGE inchangés pour l'instant, 
//      on pourra ajouter le pseudo dans les messages reçus plus tard) ...

// Rappel : Il faut remettre les fonctions TCP ici (start_tcp_server, handle_tcp_connection, send_message)
// car je les ai coupées pour la brièveté. Copie-les depuis ta version précédente 
// et ajoute juste sender_name: "Inconnu".to_string() dans ChatMessage pour l'instant.

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
                                sender_name: peer.username.clone(), // On utilise le pseudo connu
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