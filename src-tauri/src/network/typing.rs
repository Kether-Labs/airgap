use std::net::UdpSocket;
use tauri::Emitter;

pub fn start_typing_listener(app_handle: tauri::AppHandle) {
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
                    let _ = app_handle.emit("peer-typing", payload.to_string());
                }
            }
        }
    }
}