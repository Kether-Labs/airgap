// src-tauri/src/notification.rs
// Gestion des notifications custom style Telegram
 
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::WebviewWindowBuilder;
 
// Compteur pour générer des IDs uniques de fenêtre
static NOTIF_COUNTER: AtomicU32 = AtomicU32::new(0);
 
/// Affiche une notification custom dans une mini-fenêtre indépendante
/// Visible même quand l'app principale est minimisée
pub fn show_custom_notification(
    app_handle: &tauri::AppHandle,
    sender_name: &str,
    content: &str,
    sender_ip: &str,
) {
    let notif_width  = 320.0_f64;
    let notif_height = 90.0_f64;
    let margin       = 16.0_f64;
 
    // Récupère la position depuis le moniteur principal
    let (x, y) = get_notification_position(app_handle, notif_width, notif_height, margin);
 
    // Encode les paramètres pour l'URL
    let name_enc    = urlencoding::encode(sender_name).to_string();
    let content_enc = urlencoding::encode(content).to_string();
    let ip_enc      = urlencoding::encode(sender_ip).to_string();
 
    let url = format!(
        "notification.html?name={}&content={}&ip={}",
        name_enc, content_enc, ip_enc
    );
 
    // ID unique pour chaque notification (plusieurs peuvent coexister)
    let id = NOTIF_COUNTER.fetch_add(1, Ordering::SeqCst);
    let window_id = format!("notif-{}", id);
 
    println!("Affichage notification custom: {} → {}", sender_name, content);
 
    match WebviewWindowBuilder::new(
        app_handle,
        &window_id,
        tauri::WebviewUrl::App(url.into()),
    )
    .title("")
    .inner_size(notif_width, notif_height)
    .position(x, y)
    .decorations(false)     // ← pas de barre de titre OS
    .always_on_top(true)    // ← toujours au-dessus
    .skip_taskbar(true)     // ← invisible dans la barre des tâches
    .resizable(false)
    .focused(false)         // ← ne vole pas le focus de l'utilisateur
    .shadow(true)
    .build()
    {
        Ok(_)  => println!("Fenêtre notification créée: {}", window_id),
        Err(e) => println!("Erreur création notification: {:?}", e),
    }
}
 
/// Calcule la position en bas à droite de l'écran
/// Empile les notifications si plusieurs arrivent en même temps
fn get_notification_position(
    app_handle: &tauri::AppHandle,
    notif_width: f64,
    notif_height: f64,
    margin: f64,
) -> (f64, f64) {
    // Récupère le moniteur principal
    let (screen_width, screen_height) = if let Some(window) = app_handle.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let size = monitor.size();
            (size.width as f64, size.height as f64)
        } else {
            (1920.0, 1080.0) // fallback
        }
    } else {
        (1920.0, 1080.0) // fallback
    };
 
    // Compte les notifications déjà ouvertes pour empiler
    let existing_count = count_open_notifications(app_handle);
    let stack_offset = existing_count as f64 * (notif_height + margin);
 
    let x = screen_width - notif_width - margin;
    let y = screen_height - notif_height - margin - stack_offset;
 
    (x, y)
}
 
/// Compte le nombre de fenêtres de notification déjà ouvertes
fn count_open_notifications(app_handle: &tauri::AppHandle) -> u32 {
    let current = NOTIF_COUNTER.load(Ordering::SeqCst);
    let mut count = 0u32;
 
    for i in 0..current {
        let id = format!("notif-{}", i);
        if app_handle.get_webview_window(&id).is_some() {
            count += 1;
        }
    }
    count
}
 
/// Focus la fenêtre principale (appelé depuis le clic sur une notification)
#[tauri::command]
pub fn focus_main_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show().ok();
        window.set_focus().ok();
        println!("Fenêtre principale focusée");
    }
}
 