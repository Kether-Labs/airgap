use std::sync::Arc;
use tauri::State;
use crate::config;
use crate::state::AppState;

pub fn get_username(state: State<Arc<AppState>>) -> String {
    state.my_username.lock().unwrap().clone()
}

pub fn set_username(name: String, state: State<Arc<AppState>>) -> Result<(), String> {
    config::save_username(name.clone()).map_err(|e| e.to_string())?;
    *state.my_username.lock().unwrap() = name;
    Ok(())
}