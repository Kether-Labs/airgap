
use std::net::UdpSocket;
use std::thread;
use std::time::Duration;
use tauri::Emitter;



fn main() {

    tauri::Builder::default()
    .setup(|app| {

        let app_handle = app.handle();
        thread::spawn(move || {
            start_discovery_broadcast();
        });

        let handle_clone = app_handle.clone();
        thread::spawn(move || {
            start_listener(handle_clone);
        });

        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("Error while running Tauri application");
    
}

fn start_discovery_broadcast() {
    
    let socket = UdpSocket::bind("0.0.0.0:8080").expect("Failed to bind socket");

    socket.set_broadcast(true).expect("Failed to set broadcast");

    let broadcast_addr = "255.255.255.255:4242";

    let message = b"AirGap";

    

    loop {
        socket.send_to(message,broadcast_addr).expect("Failed to send broadcast");
        
        thread::sleep(Duration::from_secs(5));
    }
}

fn start_listener(app_handle:tauri::AppHandle){
    let socket = UdpSocket::bind("0.0.0.0:4242").expect("Failed to bind in port 4242");

    let mut buf = [0;1024];

     loop {

        match socket.recv_from(&mut buf) {
            Ok((amt, src)) => {
                
                let received = String::from_utf8_lossy(&buf[..amt]);

                if received.contains("AirGap:Ping") {
                    println!("received");
                    app_handle.emit("peer-found",src.to_string()).unwrap();
                }
            },
            Err(e) => {
                println!("Erreur de réception : {}", e);
            }
        }
    }
}
