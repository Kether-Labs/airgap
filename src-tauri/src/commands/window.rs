use std::sync::Arc;
use tauri::State;
use crate::state::AppState;

pub fn set_window_focused(focused: bool, state: State<Arc<AppState>>) {
    *state.window_focused.lock().unwrap() = focused;
}

pub fn set_active_peer(peer_ip: String, state: State<Arc<AppState>>) {
    *state.active_peer_ip.lock().unwrap() = peer_ip;
}