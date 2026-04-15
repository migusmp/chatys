use std::collections::HashSet;

use sqlx::PgPool;
use tokio::{fs, io};

pub mod cors;
pub mod invite;
pub mod jwt;
pub mod responses;
pub mod user_utils;

pub async fn cleanup_unused_images(pool: PgPool) -> Result<(), io::Error> {
    // 1. Leer imágenes usadas en la DB
    let used_images: Vec<String> = sqlx::query!("SELECT image FROM users WHERE image IS NOT NULL")
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            eprintln!("Error leyendo imágenes en DB: {:?}", e);
            io::Error::new(io::ErrorKind::Other, "DB error")
        })?
        .into_iter()
        .filter_map(|record| record.image)
        .collect();

    let used_set: HashSet<String> = used_images.into_iter().collect();

    // 2. Leer archivos en la carpeta
    let mut dir = fs::read_dir("./uploads/user/").await?;

    while let Some(entry) = dir.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().to_string();

        // 3. Si el archivo no está en DB, borrar
        if !used_set.contains(&file_name) {
            let file_path = entry.path();
            if let Err(e) = fs::remove_file(&file_path).await {
                eprintln!("Error eliminando archivo {:?}: {:?}", file_path, e);
            } else {
                println!("Archivo eliminado: {:?}", file_path);
            }
        }
    }

    Ok(())
}
