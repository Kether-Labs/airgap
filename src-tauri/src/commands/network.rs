use std::net::UdpSocket;
use std::sync::Arc;
use tauri::State;
use crate::state::AppState;

fn get_local_ip() -> String {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    socket.connect("8.8.8.8:80").unwrap();
    socket.local_addr().unwrap().ip().to_string()
}

pub fn get_my_ip() -> String {
    get_local_ip()
}

pub fn notify_offline(state: State<Arc<AppState>>) {
    let local_ip = get_local_ip();
    if let Ok(socket) = UdpSocket::bind(format!("{}:0", local_ip)) {
        socket.set_broadcast(true).unwrap_or(());
        let username = state.my_username.lock().unwrap().clone();
        let msg = format!("AirGap:Bye:{}", username);
        socket.send_to(msg.as_bytes(), "255.255.255.255:4242").ok();
    }
}

pub fn send_typing(peer_ip: String, state: State<Arc<AppState>>) {
    let local_ip = get_local_ip();
    if let Ok(socket) = UdpSocket::bind(format!("{}:0", local_ip)) {
        let username = state.my_username.lock().unwrap().clone();
        let msg = format!("AirGap:Typing:{}", username);
        let addr = format!("{}:4244", peer_ip);
        socket.send_to(msg.as_bytes(), addr).ok();
    }
}