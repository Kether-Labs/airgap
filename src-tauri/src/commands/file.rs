use image::{ImageEncoder, ImageReader};
use std::io::Cursor;
use std::path::Path;

pub fn load_and_compress_image(path: &str, max_width: u32, quality: u8) -> Result<(Vec<u8>, Vec<u8>, String), String> {
    let path = Path::new(path);
    
    let img = ImageReader::open(path)
        .map_err(|e| format!("Impossible d'ouvrir l'image: {}", e))?
        .decode()
        .map_err(|e| format!("Impossible de décoder l'image: {}", e))?;

    let (width, height) = (img.width(), img.height());
    let mut final_width = max_width;
    let mut final_height = (height as f32 * (max_width as f32 / width as f32)) as u32;
    
    if width > height {
        final_width = max_width;
        final_height = (height as f32 * (max_width as f32 / width as f32)) as u32;
    } else {
        final_height = max_width;
        final_width = (width as f32 * (max_width as f32 / height as f32)) as u32;
    }

    if width <= max_width && height <= max_width {
        final_width = width;
        final_height = height;
    }

    let resized = img.thumbnail(final_width, final_height);
    
    let mut full_data = Vec::new();
    let mut cursor = Cursor::new(&mut full_data);
    resized.write_to(&mut cursor, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Erreur compression: {}", e))?;

    let thumb_size = (max_width / 3).max(100);
    let mut thumb_width = thumb_size;
    let mut thumb_height = (height as f32 * (thumb_width as f32 / width as f32)) as u32;
    
    if width > height {
        thumb_height = thumb_size;
        thumb_width = (width as f32 * (thumb_size as f32 / height as f32)) as u32;
    }
    
    let thumbnail = img.thumbnail(thumb_width, thumb_height);
    let mut thumb_data = Vec::new();
    let mut thumb_cursor = Cursor::new(&mut thumb_data);
    thumbnail.write_to(&mut thumb_cursor, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Erreur thumbnail: {}", e))?;

    let media_type = "image/jpeg".to_string();

    Ok((full_data, thumb_data, media_type))
}

pub fn encode_image_to_base64(data: &[u8]) -> String {
    use base64::{Engine as _, engine::general_purpose};
    general_purpose::STANDARD.encode(data)
}

pub fn decode_base64_to_image(b64: &str) -> Result<Vec<u8>, String> {
    use base64::{Engine as _, engine::general_purpose};
    general_purpose::STANDARD.decode(b64)
        .map_err(|e| format!("Erreur décodage base64: {}", e))
}