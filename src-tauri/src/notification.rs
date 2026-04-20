// src-tauri/src/notification.rs

use std::sync::atomic::{AtomicU32, Ordering};
use std::fs;
use tauri::{Manager, WebviewWindowBuilder};

static NOTIF_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Génère le HTML de la notification avec les données intégrées
fn build_notification_html(sender_name: &str, content: &str) -> String {
    let name_escaped    = sender_name
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('"', "&quot;");
    let content_escaped = content
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('"', "&quot;");
    let avatar_letter = sender_name
        .chars()
        .next()
        .unwrap_or('?')
        .to_uppercase()
        .to_string();
    
    let colors = [
        "#ff516a", "#3fc380", "#19b5fe", "#f9690e", "#f64747", "#be90d4", "#fef160", "#4d13d1"
    ];
    let first_char = sender_name.chars().next().unwrap_or('A');
    let color = colors[(first_char as usize) % colors.len()];

    format!(r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ 
    width: 340px; height: 110px; 
    overflow: hidden; 
    background: transparent; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
  }}
  .card {{
    width: 310px; height: 80px;
    background: #1c2b38;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    display: flex; align-items: center; gap: 14px;
    padding: 0 16px;
    cursor: pointer;
    position: relative; overflow: hidden;
    animation: slideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }}
  .card.closing {{ animation: slideOut 0.3s ease-in forwards; }}
  @keyframes slideIn {{
    from {{ opacity: 0; transform: translateY(110%); }}
    to   {{ opacity: 1; transform: translateY(0); }}
  }}
  @keyframes slideOut {{
    from {{ opacity: 1; transform: translateY(0); }}
    to   {{ opacity: 0; transform: translateY(110%); }}
  }}
  .avatar {{
    width: 48px; height: 48px; border-radius: 50%;
    background: {color};
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 600; color: #fff;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }}
  .body {{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }}
  .name {{
    font-size: 14px; font-weight: 700; color: #72b1df;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }}
  .msg {{
    font-size: 13px; color: #f5f5f5; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }}
  .close {{
    width: 24px; height: 24px; border-radius: 50%;
    background: rgba(255,255,255,0.05);
    border: none;
    color: rgba(255,255,255,0.3); cursor: pointer; font-size: 14px;
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; outline: none;
  }}
  .close:hover {{ background: rgba(255,255,255,0.1); color: #fff; }}
  .progress {{
    position: absolute; bottom: 0; left: 0;
    height: 3px; width: 100%; background: linear-gradient(to right, #72b1df, #1c2b38);
    transform-origin: left;
    animation: shrink 4s linear forwards;
  }}
  @keyframes shrink {{
    from {{ transform: scaleX(1); }}
    to   {{ transform: scaleX(0); }}
  }}
</style>
</head>
<body>
<div class="card" id="card">
  <div class="avatar">{avatar}</div>
  <div class="body">
    <div class="name">{name}</div>
    <div class="msg">{content}</div>
  </div>
  <button class="close" id="close-btn">✕</button>
  <div class="progress"></div>
</div>
<script>
  const card = document.getElementById('card');
  const closeBtn = document.getElementById('close-btn');
  let closing = false;

  const timer = setTimeout(doClose, 4000);

  function doClose() {{
    if (closing) return;
    closing = true;
    clearTimeout(timer);
    card.classList.add('closing');
    setTimeout(() => window.close(), 260);
  }}

  closeBtn.addEventListener('click', (e) => {{
    e.stopPropagation();
    doClose();
  }});

  card.addEventListener('click', async () => {{
    try {{
      const {{ invoke }} = window.__TAURI__.core;
      await invoke('focus_main_window');
    }} catch(e) {{
      console.log('focus error:', e);
    }}
    doClose();
  }});
</script>
</body>
</html>"#,
        avatar  = avatar_letter,
        name    = name_escaped,
        content = content_escaped,
        color   = color,
    )
}

/// Affiche une notification custom dans une mini-fenêtre indépendante
pub fn show_custom_notification(
    app_handle: &tauri::AppHandle,
    sender_name: &str,
    content: &str,
    _sender_ip: &str,
) {
    let notif_width  = 340.0_f64;
    let notif_height = 110.0_f64;
    let margin       = 12.0_f64;

    let (x, y) = get_notification_position(app_handle, notif_width, notif_height, margin);

    let id        = NOTIF_COUNTER.fetch_add(1, Ordering::SeqCst);
    let window_id = format!("notif-{}", id);

    // Écrit le HTML dans un fichier temporaire
    let tmp_path = std::env::temp_dir().join(format!("airgap-notif-{}.html", id));
    let html     = build_notification_html(sender_name, content);

    if let Err(e) = fs::write(&tmp_path, &html) {
        println!("Erreur écriture HTML notif: {}", e);
        return;
    }

    // Construit l'URL file:// vers le fichier temporaire
    let file_url = format!("file://{}", tmp_path.to_string_lossy().replace('\\', "/"));

    println!("Notification custom: {} → {} ({})", sender_name, content, file_url);

    let url: tauri::WebviewUrl = match file_url.parse() {
        Ok(u)  => tauri::WebviewUrl::External(u),
        Err(e) => {
            println!("Erreur parsing URL notif: {}", e);
            return;
        }
    };

    match WebviewWindowBuilder::new(app_handle, &window_id, url)
        .title("")
        .inner_size(notif_width, notif_height)
        .position(x, y)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .shadow(true)
        .transparent(true)
        .build()
    {
        Ok(_)  => println!("Notification affichée ✅ ({})", window_id),
        Err(e) => println!("Erreur notification: {:?}", e),
    }

    // Nettoyage du fichier temporaire après 6s (durée de vie de la notif)
    let tmp_path_clone = tmp_path.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(6));
        fs::remove_file(&tmp_path_clone).ok();
    });
}

/// Calcule la position en bas à droite — empile si plusieurs notifications ouvertes
fn get_notification_position(
    app_handle: &tauri::AppHandle,
    notif_width: f64,
    notif_height: f64,
    margin: f64,
) -> (f64, f64) {
    let (screen_width, screen_height): (f64, f64) =
        if let Some(window) = app_handle.get_webview_window("main") {
            match window.current_monitor() as Result<Option<tauri::Monitor>, _> {
                Ok(Some(monitor)) => {
                    let size = monitor.size();
                    (size.width as f64, size.height as f64)
                }
                _ => (1920.0, 1080.0),
            }
        } else {
            (1920.0, 1080.0)
        };

    let existing     = count_open_notifications(app_handle);
    let stack_offset = existing as f64 * (notif_height + margin);

    let x = screen_width  - notif_width  - margin;
    let y = screen_height - notif_height - margin - stack_offset;

    (x, y)
}

/// Compte les fenêtres de notification encore ouvertes
fn count_open_notifications(app_handle: &tauri::AppHandle) -> u32 {
    let current = NOTIF_COUNTER.load(Ordering::SeqCst);
    let mut count = 0u32;
    for i in 0..current {
        if app_handle.get_webview_window(&format!("notif-{}", i)).is_some() {
            count += 1;
        }
    }
    count
}

/// Focus la fenêtre principale — appelé depuis le clic sur la notification
#[tauri::command]
pub fn focus_main_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show().ok();
        window.set_focus().ok();
        println!("Fenêtre principale focusée ✅");
    }
}