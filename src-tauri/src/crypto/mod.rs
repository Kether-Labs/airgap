use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{Engine as _, engine::general_purpose};
use x25519_dalek::{PublicKey, StaticSecret};

pub fn encrypt_message(
    shared_secret: &StaticSecret,
    peer_public_key: &PublicKey,
    content: &str,
) -> Result<(String, String), String> {
    let dh = shared_secret.diffie_hellman(peer_public_key);
    let cipher = Aes256Gcm::new_from_slice(dh.as_bytes()).unwrap();
    let nonce_bytes = rand::random::<[u8; 12]>();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, content.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok((
        general_purpose::STANDARD.encode(&ciphertext),
        general_purpose::STANDARD.encode(&nonce_bytes),
    ))
}

pub fn decrypt_message(
    shared_secret: &StaticSecret,
    peer_public_key: &PublicKey,
    cipher_b64: &str,
    nonce_b64: &str,
) -> Result<String, String> {
    let dh = shared_secret.diffie_hellman(peer_public_key);
    let cipher = Aes256Gcm::new_from_slice(dh.as_bytes()).unwrap();
    let ciphertext = general_purpose::STANDARD.decode(cipher_b64)
        .map_err(|e| e.to_string())?;
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)
        .map_err(|e| e.to_string())?;

    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }

    let nonce = Nonce::from_slice(&nonce_bytes);
    let decrypted = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| e.to_string())?;
    String::from_utf8(decrypted).map_err(|e| e.to_string())
}