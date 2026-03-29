use crate::utils::jwt::generate_token;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

use sqlx::{prelude::FromRow, types::Json as JsonSqlx};
use time::OffsetDateTime;

use crate::db::offset_date_time_serde;
use crate::errors::AppError;

#[derive(Debug, Deserialize, Clone)]
pub struct RegisterUser {
    pub username: String,
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, sqlx::FromRow, Deserialize, Serialize, Clone)]
pub struct UserData {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
    pub image: String,
    pub created_at: NaiveDateTime,
    pub description: String,
    // pub friends_count: i64,
}

#[derive(Debug, sqlx::FromRow, Deserialize, Serialize, Clone)]
pub struct UserSearchData {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub image: String,
    pub description: String,
}

#[derive(Debug, sqlx::FromRow, Deserialize, Serialize, Clone)]
pub struct ProfileData {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub image: String,
    pub created_at: NaiveDateTime,
    pub friends_count: i64,
    pub description: String,
}

#[derive(Debug, sqlx::FromRow, Deserialize, Serialize, Clone)]
pub struct UserChatData {
    pub username: String,
    pub image: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginUser {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
    pub image: String,
    pub password: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Payload {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
    pub image: String,
    pub created_at: Option<String>,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateData {
    pub username: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
    pub description: Option<String>,
}

pub struct UserFriendRequest {
    pub id: i32,
    pub username: String,
    pub image: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, FromRow)]
pub struct UserSummary {
    pub id: i32,
    pub username: String,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RawConversationSummary {
    pub conversation_id: i32,
    pub is_group: Option<bool>,

    #[serde(with = "offset_date_time_serde")]
    pub updated_at: Option<OffsetDateTime>,

    pub last_message_content: Option<String>,
    pub last_message_sender_id: Option<i32>,

    #[serde(with = "offset_date_time_serde")]
    pub last_message_created_at: Option<OffsetDateTime>,

    pub participants: JsonSqlx<Vec<UserSummary>>,
}
pub type ErrorRequest = AppError;

impl RegisterUser {
    pub fn new(username: String, name: String, email: String, password: String) -> RegisterUser {
        RegisterUser {
            username,
            name,
            email,
            password,
        }
    }
}

impl LoginUser {
    pub fn new(username: String, password: String) -> Self {
        LoginUser { username, password }
    }
}

impl Payload {
    pub fn new(
        id: i32,
        username: String,
        name: String,
        email: String,
        image: String,
        created_at: Option<String>,
        exp: i64,
        iat: i64,
    ) -> Self {
        let created_at = match created_at {
            Some(datetime) => Some(datetime.to_string()),
            None => None,
        };

        Payload {
            id,
            username,
            name,
            email,
            image,
            created_at,
            exp,
            iat,
        }
    }

    pub fn token(&self) -> Result<String, jsonwebtoken::errors::Error> {
        generate_token(self)
    }
}
