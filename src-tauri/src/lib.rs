mod state;
mod config;
mod commands;
mod crypto;
mod db;
mod network;
mod notification;

pub use state::{AppState, PeerInfo, ChatMessage, UserConfig};

pub use network::{
    start_discovery_broadcast,
    start_listener,
    start_tcp_server,
    start_typing_listener,
};

pub use config::save_username;

pub use db::{init_db, save_message, load_history, save_peer, load_peers, DbMessage};

pub use notification::focus_main_window;