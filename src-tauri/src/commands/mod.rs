pub mod message;
pub mod media;
pub mod file;
pub use file::{load_and_compress_image, encode_image_to_base64, decode_base64_to_image};
pub mod user;
pub mod history;
pub mod window;
pub mod network;
pub use media::send_media;

pub use message::send_message;
pub use user::{get_username, set_username};
pub use history::{get_history, get_saved_peers};
pub use window::{set_window_focused, set_active_peer};
pub use network::{get_my_ip, notify_offline, send_typing};