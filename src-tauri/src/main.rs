
use std::net::{UdpSocket, TcpListener, TcpStream}
use std::thread;
use std::time::Duration;
use tauri::Emitter;
use std::io::{Read, Write,BufReader,BufRead};
use serde::{Deserialize,Serialize};

#[derive(Clone,Serialize,Deserialize,Debug)]
struct ChatMessage {
    sender_ip:String,
    content:String,
}
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

        let handle_tcp = app_handle.clone();
            thread::spawn(move || {
                start_tcp_server(handle_tcp);
            });

        Ok(())
    })
    .invoke_handler(tauri::generate_handler![send_message])
    .run(tauri::generate_context!())
    .expect("Error while running Tauri application");
    
}

fn start_discovery_broadcast() {
    
    let socket = UdpSocket::bind("0.0.0.0:8080").expect("Failed to bind socket");

    socket.set_broadcast(true).expect("Failed to set broadcast");

    let broadcast_addr = "255.255.255.255:4242";

    let message = b"AirGap:Ping";

    

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

fn start_tcp_server(app_handle:tauri::AppHandle){

    let listener = TcpListener::bind("0.0.0.0:4243").expect("Failed to bind in port 4243");

    println!("TCP server started on port 4243");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                println!("New connection from {}", stream.peer_addr().unwrap());
                let handle_clone = app_handle.clone();
                thread::spawn(move || {
                    handle_tcp_connection(stream, handle_clone);
                });
            },
            Err(e) => {
                println!("Error: {}", e);
            }
        }
    }
}

fn handle_tcp_connection(mut stream: TcpStream, app_handle: tauri::AppHandle) {
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();

    // On lit une ligne envoyée par le pair
    match reader.read_line(&mut line) {
        Ok(_) => {
            // On récupère l'IP de l'expéditeur
            let sender_addr = stream.peer_addr().unwrap().ip().to_string();
            
            // On crée l'objet message (en enlevant le saut de ligne \n)
            let msg = ChatMessage {
                sender_ip: sender_addr,
                content: line.trim().to_string(),
            };

            println!("Message reçu de {} : {}", msg.sender_ip, msg.content);
            
            // On envoie au Frontend
            app_handle.emit("message-received", msg).unwrap();
        },
        Err(e) => println!("Erreur lecture TCP: {}", e),
    }
}

#[tauri::command]
fn send_message(peer_ip: String, content: String) -> Result<(), String> {
    // On se connecte au pair sur le port 4243
    let addr = format!("{}:4243", peer_ip);
    
    match TcpStream::connect(&addr) {
        Ok(mut stream) => {
            // On ajoute un saut de ligne pour délimiter le message
            let message = format!("{}\n", content);
            
            // On envoie les bytes
            stream.write_all(message.as_bytes()).map_err(|e| e.to_string())?;
            println!("Message envoyé à {}", addr);
            Ok(())
        },
        Err(e) => {
            println!("Impossible de joindre {}: {}", addr, e);
            Err(format!("Impossible de joindre le pair: {}", e))
        }
    }
}
    



