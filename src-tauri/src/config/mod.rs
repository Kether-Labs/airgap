use std::fs;
use std::io;
use std::path::PathBuf;

pub fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("airgap");
    fs::create_dir_all(&path).ok();
    path.push("user_config.json");
    path
}

pub fn load_username() -> Result<String, io::Error> {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(path)?;
        if let Ok(config) = serde_json::from_str::<crate::state::UserConfig>(&content) {
            return Ok(config.username);
        }
    }
    Ok("".to_string())
}

pub fn derive_db_key() -> [u8; 32] {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "airgap-default".to_string());
    let hostname = hostname.trim();
    let salt = b"airgap-db-key-v1";
    let input = format!("{}{}", hostname, String::from_utf8_lossy(salt));
    use sha2::{Sha256, Digest};
    let hash = Sha256::digest(input.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

pub fn save_username(name: String) -> Result<(), io::Error> {
    let path = get_config_path();
    let json = format!("{{\"username\": \"{}\"}}", name);
    fs::write(path, json)?;
    Ok(())
}