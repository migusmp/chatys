use dotenv::dotenv;
use serde::Serialize;
use sqlx::postgres::PgPoolOptions;
use sqlx::Error;
use sqlx::PgPool;
use std::env;

use crate::errors::AppError;
use crate::models::user::ProfileData;
use crate::models::user::UserChatData;
use crate::models::user::UserData;
use crate::models::user::UserFriendRequest;
use crate::models::user::UserSearchData;

// Función para obtener el pool de conexiones a la base de datos
// pub async fn get_db_pool() -> Result<PgPool, sqlx::Error> {
//     dotenv().ok();
//
//     let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");
//
//     // let pool = PgPool::connect(&database_url).await?;
//     let pool = PgPoolOptions::new()
//         .max_connections(350)
//         .connect(&database_url)
//         .await?;
//     Ok(pool)
// }

pub async fn init_db_pool() -> PgPool {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .idle_timeout(std::time::Duration::from_secs(10))
        .connect(&database_url)
        .await
        .expect("Failed to connect to the database");

    pool
}

// Función para crear la tabla de usuarios si no existe
pub async fn create_users_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    let create_table_query = r#"
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR NOT NULL,
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    "#;

    sqlx::query(create_table_query).execute(pool).await?;

    Ok(())
}

// Función para insertar un nuevo usuario
// Guardamos al usuario en la BBDD.
pub async fn insert_user(
    username: &String,
    name: &String,
    email: &String,
    pool: &PgPool,
    hashed_pwd: &String,
) -> Result<(), Error> {
    let query = r#"
        INSERT INTO users (username, name, email, password)
        VALUES ($1, $2, $3, $4)
    "#;

    sqlx::query(query)
        .bind(username)
        .bind(name)
        .bind(email)
        .bind(hashed_pwd)
        .execute(&*pool) // Ejecutamos sin transacción
        .await?;

    Ok(())
}

pub async fn update_user_image(
    user_id: i32,
    new_image_name: String,
    pool: &PgPool,
) -> Result<(), Error> {
    let query = r#"
        UPDATE users
        SET image = $1
        WHERE id = $2
    "#;
    sqlx::query(query)
        .bind(new_image_name)
        .bind(user_id)
        .execute(&*pool) // Ejecutamos sin transacción
        .await?;

    Ok(())
}

pub async fn search_user(
    username: String,
    pool: &PgPool,
) -> Result<Vec<UserSearchData>, sqlx::Error> {
    let pattern = format!("%{}%", username);

    sqlx::query_as::<_, UserSearchData>(
        r#"
    SELECT * FROM users WHERE username ILIKE $1
"#,
    )
    .bind(pattern)
    .fetch_all(pool)
    .await
}

pub async fn update_user_name(username: String, id: i32, pool: &PgPool) -> Result<(), AppError> {
    let query = r#"
        UPDATE users
        SET username = $1
        WHERE id = $2
          AND NOT EXISTS (
              SELECT 1
              FROM users
              WHERE username = $1
                AND id != $2
          )
    "#;

    let info = sqlx::query(query).bind(&username).bind(id).execute(pool).await?;

    if info.rows_affected() > 0 {
        Ok(())
    } else {
        Err(AppError::UserAlreadyExists)
    }
}

async fn update_name(new_name: String, id: i32, pool: &PgPool) -> Result<(), Error> {
    let query = r#"
        UPDATE users
        SET name = $1
        WHERE id = $2
    "#;
    sqlx::query(query)
        .bind(new_name)
        .bind(id)
        .execute(&*pool)
        .await?;
    Ok(())
}

async fn update_description(new_description: String, id: i32, pool: &PgPool) -> Result<(), Error> {
    let query = r#"
        UPDATE users
        SET description = $1
        WHERE id = $2
    "#;
    sqlx::query(query)
        .bind(new_description)
        .bind(id)
        .execute(&*pool)
        .await?;
    Ok(())
}

pub async fn update_user_description(
    new_description: String,
    id: i32,
    pool: &PgPool,
) -> Result<(), AppError> {
    update_description(new_description, id, pool)
        .await
        .map_err(|_| AppError::InternalError)
}

// TODO
pub async fn update_user_pwd(new_pwd: String, id: i32, pool: &PgPool) -> Result<(), AppError> {
    let pwd = bcrypt::hash(&new_pwd, 4).map_err(|_| AppError::ErrorPasswordUpdate)?;
    let query = r#"
        UPDATE users
        SET password = $1
        WHERE id = $2
    "#;

    sqlx::query(query)
        .bind(pwd)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|_| AppError::ErrorPasswordUpdate)?;

    Ok(())
}

pub async fn update_user_email(new_email: String, id: i32, pool: &PgPool) -> Result<(), AppError> {
    check_updated_email(&new_email)?;

    let query = r#"
        UPDATE users
        SET email = $1
        WHERE id = $2
          AND NOT EXISTS (
              SELECT 1
              FROM users
              WHERE email = $1
                AND id != $2
          )
    "#;

    match sqlx::query(query).bind(&new_email).bind(id).execute(pool).await {
        Ok(info) if info.rows_affected() > 0 => Ok(()),
        Ok(_) => Err(AppError::EmailExists),
        Err(_) => Err(AppError::ErrorEmailUpdate),
    }
}

pub async fn update_name_from_user(new_name: String, id: i32, pool: &PgPool) -> Result<(), AppError> {
    match update_name(new_name, id, &pool).await {
        Ok(_) => Ok(()),
        Err(_) => Err(AppError::InternalError),
    }
}

fn check_updated_email(new_email: &str) -> Result<(), AppError> {
    let email = new_email.trim();
    if email.is_empty() || email.contains(char::is_whitespace) {
        return Err(AppError::InvalidEmail);
    }

    let mut parts = email.split('@');
    let local = parts.next();
    let domain = parts.next();

    if parts.next().is_some() {
        return Err(AppError::InvalidEmail);
    }

    let (Some(local), Some(domain)) = (local, domain) else {
        return Err(AppError::InvalidEmail);
    };

    if local.is_empty() || domain.is_empty() || !domain.contains('.') {
        return Err(AppError::InvalidEmail);
    }

    let segments: Vec<&str> = domain.split('.').collect();
    if segments.iter().any(|segment| segment.is_empty()) {
        return Err(AppError::InvalidEmail);
    }

    let has_valid_tld = segments
        .last()
        .is_some_and(|tld| tld.len() >= 2 && tld.chars().all(|c| c.is_ascii_alphabetic()));

    if !has_valid_tld {
        return Err(AppError::InvalidEmail);
    }

    Ok(())
}

#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct Friend {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub image: String,
}

pub async fn get_user_friends(user_id: i32, pool: &PgPool) -> Result<Vec<Friend>, sqlx::Error> {
    let query = r#"
        SELECT u.id, u.username, u.name, u.image 
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = $1
    "#;

    let friends = sqlx::query_as::<_, Friend>(query)
        .bind(user_id)
        .fetch_all(pool)
        .await?;

    Ok(friends)
}

pub async fn get_user_friends_by_username(
    username: String,
    pool: &PgPool,
) -> Result<Vec<Friend>, sqlx::Error> {
    let query = r#"
        SELECT u.id, u.username, u.name, u.image 
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = (
            SELECT id FROM users WHERE username = $1
        )
    "#;

    let friends = sqlx::query_as::<_, Friend>(query)
        .bind(username)
        .fetch_all(pool)
        .await?;

    Ok(friends)
}

// TODO
pub async fn get_user_data_to_friend_request(id: i32, pool: &PgPool) -> Result<(), sqlx::Error> {
    let _user = sqlx::query_as!(
        UserFriendRequest,
        r#"
        SELECT id, username, image
        FROM users
        WHERE id = $1
        "#,
        id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch user: {}", e));

    Ok(())
}

pub async fn find_user_by_username(username: String, pool: &PgPool) -> Result<i32, sqlx::Error> {
    let query = r#"
        SELECT id 
        FROM users 
        WHERE username = $1
    "#;

    let user_id = sqlx::query_scalar::<_, i32>(query)
        .bind(username)
        .fetch_one(pool)
        .await?;

    Ok(user_id)
}

pub async fn get_user_profile_data(user_id: i32, pool: &PgPool) -> Result<UserData, sqlx::Error> {
    let query = r#"
        SELECT 
            u.id,
            u.username,
            u.email,
            u.name,
            u.created_at,
            u.image,
            u.description,
            (
                SELECT COUNT(*) 
                FROM friends f1
                WHERE f1.user_id = u.id
                AND EXISTS (
                    SELECT 1 
                    FROM friends f2
                    WHERE f2.user_id = f1.friend_id 
                    AND f2.friend_id = f1.user_id
                )
            ) AS friends_count
        FROM users u
        WHERE u.id = $1
    "#;

    let user_data = sqlx::query_as::<_, UserData>(&query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    Ok(user_data)
}

pub async fn get_user_profile_data_by_username(
    username: String,
    pool: &PgPool,
) -> Result<ProfileData, sqlx::Error> {
    let query = r#"
        SELECT 
            u.id, 
            u.username, 
            u.name, 
            u.created_at, 
            u.image,
            u.description,
            (
                SELECT COUNT(*) 
                FROM friends f1
                WHERE f1.user_id = u.id
                AND EXISTS (
                    SELECT 1 
                    FROM friends f2
                    WHERE f2.user_id = f1.friend_id 
                    AND f2.friend_id = f1.user_id
                )
            ) AS friends_count
        FROM users u
        WHERE u.username = $1
    "#;

    let user_data = sqlx::query_as::<_, ProfileData>(&query)
        .bind(username)
        .fetch_one(pool)
        .await?;

    Ok(user_data)
}

pub async fn get_user_chat_data(user_id: i32, pool: &PgPool) -> Result<UserChatData, sqlx::Error> {
    let query = r#"
        SELECT username, image
        FROM users
        WHERE id = $1
    "#;

    let user_data = sqlx::query_as::<_, UserChatData>(query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    Ok(user_data)
}

pub async fn delete_all_db(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Ejecutamos la consulta para borrar todos los datos de la tabla
    sqlx::query("DELETE FROM users").execute(pool).await?;
    sqlx::query("DELETE FROM friend_requests")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM friends").execute(pool).await?;
    Ok(())
}

pub async fn delete_user(user_id: i32, pool: PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await?;
    Ok(())
}
