use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::Emitter;

mod state;
mod config;
mod commands;
mod crypto;
mod db;
mod network;
mod notification;

use state::AppState;

#[tauri::command] fn send_message(
    peer_ip: String,
    content: String,
    msg_id: String,
    state: tauri::State<Arc<AppState>>,
) -> Result<(), String> {
    commands::send_message(peer_ip, content, msg_id, state)
}

#[tauri::command] fn get_username(state: tauri::State<Arc<AppState>>) -> String {
    commands::get_username(state)
}

#[tauri::command] fn set_username(name: String, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    commands::set_username(name, state)
}

#[tauri::command] fn get_history(peer_ip: String, state: tauri::State<Arc<AppState>>) -> Vec<db::DbMessage> {
    commands::get_history(peer_ip, state)
}

#[tauri::command] fn get_saved_peers(state: tauri::State<Arc<AppState>>) -> Vec<serde_json::Value> {
    commands::get_saved_peers(state)
}

#[tauri::command] fn send_typing(peer_ip: String, state: tauri::State<Arc<AppState>>) {
    commands::send_typing(peer_ip, state)
}

#[tauri::command] fn set_window_focused(focused: bool, state: tauri::State<Arc<AppState>>) {
    commands::set_window_focused(focused, state)
}

#[tauri::command] fn get_my_ip() -> String {
    commands::get_my_ip()
}

#[tauri::command] fn notify_offline(state: tauri::State<Arc<AppState>>) {
    commands::notify_offline(state)
}

#[tauri::command] fn set_active_peer(peer_ip: String, state: tauri::State<Arc<AppState>>) {
    commands::set_active_peer(peer_ip, state)
}

fn main() {
    let state = match AppState::new() {
        Ok(s) => Arc::new(s),
        Err(e) => panic!("Impossible d'initialiser l'état: {}", e),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![
            send_message,
            get_username,
            set_username,
            get_history,
            get_saved_peers,
            send_typing,
            set_window_focused,
            get_my_ip,
            notify_offline,
            set_active_peer,
        ])
        .setup(move |app| {
            let app_handle = app.handle();

            let state_udp = state.clone();
            thread::spawn(move || {
                network::start_discovery_broadcast(state_udp);
            });

            let state_listen = state.clone();
            let handle_udp = app_handle.clone();
            thread::spawn(move || {
                network::start_listener(handle_udp, state_listen);
            });

            let state_tcp = state.clone();
            let handle_tcp = app_handle.clone();
            thread::spawn(move || {
                network::start_tcp_server(handle_tcp, state_tcp);
            });

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

            let handle_typing = app_handle.clone();
            thread::spawn(move || {
                network::start_typing_listener(handle_typing);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}