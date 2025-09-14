use crate::utils::jwt::generate_token;
use crate::utils::responses::ErrorResponse;
use axum::{http::StatusCode, response::IntoResponse, Json};
use chrono::{ NaiveDateTime};
use serde::{Deserialize, Serialize};

use sqlx::{prelude::FromRow, types::Json as JsonSqlx};
use time::OffsetDateTime;

use crate::db::offset_date_time_serde;



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
    pub friends_count: i64,
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
    pub password: String,
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
    pub image: Option<String>
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
pub enum ErrorRequest {
    UsernameInvalid,
    NameEmpty,
    UsernameEmpty,
    InvalidEmail,
    ShortPassword,
    UserAlreadyExists,
    InternalError,
    InvalidFriendRequest,
    DuplicateFriendRequest,
    NoFriendRequestFound,
    InvalidImageSize,
    InvalidImageFormat,
    InvalidParameter,
    ErrorPasswordUpdate,
    ErrorEmailUpdate,
    AlreadyFriends,
    EmailExists,
    BadParameter,
    OnlyOneFileAllowed,
    FileTooLarge,
}

impl IntoResponse for ErrorRequest {
    fn into_response(self) -> axum::response::Response {
        let (status, err_type, err_msg) = match self {
            ErrorRequest::UsernameInvalid => (
                StatusCode::BAD_REQUEST,
                "USERNAME_INVALID",
                "Invalid username",
            ),
            ErrorRequest::UsernameEmpty => (
                StatusCode::BAD_REQUEST,
                "USERNAME_EMPTY",
                "You must enter a username",
            ),
            ErrorRequest::NameEmpty => (
                StatusCode::BAD_REQUEST,
                "NAME_EMPTY",
                "You must enter a name",
            ),
            ErrorRequest::InvalidEmail => (
                StatusCode::BAD_REQUEST,
                "EMAIL_INVALID",
                "Invalid email",
            ),
            ErrorRequest::ShortPassword => (
                StatusCode::BAD_REQUEST,
                "SHORT_PASSWORD",
                "Password is too short",
            ),
            ErrorRequest::UserAlreadyExists => (
                StatusCode::CONFLICT,
                "USER_ALREADY_EXISTS",
                "User already exists",
            ),
            ErrorRequest::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Internal error",
            ),
            ErrorRequest::InvalidImageSize => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "IMAGE_TOO_LARGE",
                "Image exceeds the maximum allowed size of 5MB.",
            ),
            ErrorRequest::InvalidFriendRequest => (
                StatusCode::BAD_REQUEST,
                "INVALID_FRIEND_REQUEST",
                "You can't add yourself as a friend",
            ),
            ErrorRequest::InvalidParameter => (
                StatusCode::BAD_REQUEST,
                "INVALID_PARAMETER",
                "Invalid parameter provided in request",
            ),
            ErrorRequest::DuplicateFriendRequest => (
                StatusCode::OK,
                "DUPLICATE_FRIEND_REQUEST",
                "You requested friendship before",
            ),
            ErrorRequest::NoFriendRequestFound => (
                StatusCode::BAD_REQUEST,
                "NO_FRIEND_REQUEST_FOUND",
                "No friend request found",
            ),
            ErrorRequest::InvalidImageFormat => (
                StatusCode::BAD_REQUEST,
                "INVALID_IMAGE_FORMAT",
                "Invalid image format",
            ),
            ErrorRequest::ErrorPasswordUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "ERROR_PASSWORD_UPDATE",
                "Error updating password",
            ),
            ErrorRequest::ErrorEmailUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "ERROR_EMAIL_UPDATE",
                "Error updating email",
            ),
            ErrorRequest::EmailExists => (
                StatusCode::BAD_REQUEST,
                "EMAIL_EXISTS",
                "Email already exists",
            ),
            ErrorRequest::AlreadyFriends => (
                StatusCode::OK,
                "ALREADY_FRIENDS",
                "You are already friends with this user",
            ),
            ErrorRequest::BadParameter => (
                StatusCode::BAD_REQUEST,
                "BAD_PARAMETER",
                "Bad parameter provided in request",
            ),
            ErrorRequest::OnlyOneFileAllowed => (StatusCode::BAD_REQUEST, "ONLY_ONE_FILE_ALLOWED", "You can upload one file at the same time!"),
            ErrorRequest::FileTooLarge => (StatusCode::PAYLOAD_TOO_LARGE, "FILE_TO_LARGE", "The uploaded file is too large. Maximum allowed size is 5 MB")
        };

        let body = Json(ErrorResponse {
            status: "error".to_string(),
            r#type: err_type.to_string(),
            message: err_msg.to_string(),
        });

        (status, body).into_response()
    }
}

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
        password: String,
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
            password,
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
