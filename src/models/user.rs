use crate::utils::jwt::generate_token;
use crate::utils::responses::ErrorResponse;
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct RegisterUser {
    pub username: String,
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, sqlx::FromRow, Deserialize, Serialize, Clone)]
pub struct UserData {
    id: i32,
    username: String,
    name: String,
    email: String,
    image: String,
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
}

pub enum ErrorRequest {
    UsernameInvalid,
    NameEmpty,
    UsernameEmpty,
    InvalidEmail,
    PasswordInvalid,
    UserAlreadyExists,
    InternalError,
    InvalidFriendRequest,
    DuplicateFriendRequest,
    NoFriendRequestFound,
    InvalidImageSize,
    InvalidImageFormat,
    ErrorPasswordUpdate,
    ErrorEmailUpdate,
    AlreadyFriends,
    EmailExists,
}

impl IntoResponse for ErrorRequest {
    fn into_response(self) -> axum::response::Response {
        let (status, err_msg) = match self {
            ErrorRequest::UsernameInvalid => (StatusCode::BAD_REQUEST, "Invalid username"),
            ErrorRequest::UsernameEmpty => (StatusCode::BAD_REQUEST, "You must enter a username"),
            ErrorRequest::NameEmpty => (StatusCode::BAD_REQUEST, "You must enter a name"),
            ErrorRequest::InvalidEmail => (StatusCode::BAD_REQUEST, "Invalid email"),
            ErrorRequest::PasswordInvalid => (StatusCode::BAD_REQUEST, "invalid password"),
            ErrorRequest::UserAlreadyExists => (StatusCode::CONFLICT, "User already exists"),
            ErrorRequest::InternalError => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            ErrorRequest::InvalidImageSize => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "Image exceeds the maximum allowed size of 5MB.",
            ),
            ErrorRequest::InvalidFriendRequest => (
                StatusCode::BAD_REQUEST,
                "You can't add yourself as a friend",
            ),
            ErrorRequest::DuplicateFriendRequest => {
                (StatusCode::OK, "You requested frienship before")
            }

            ErrorRequest::NoFriendRequestFound => {
                (StatusCode::BAD_REQUEST, "No friend request found")
            }

            ErrorRequest::InvalidImageFormat => (StatusCode::BAD_REQUEST, "Invalid Image format"),
            ErrorRequest::ErrorPasswordUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error to update password",
            ),
            ErrorRequest::ErrorEmailUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error al actualizar el email",
            ),
            ErrorRequest::EmailExists => (StatusCode::BAD_REQUEST, "Email does exists"),
            ErrorRequest::AlreadyFriends => {
                (StatusCode::OK, "You are already friends with this user")
            }
        };
        let body = Json(ErrorResponse {
            status: "error".to_string(),
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
        password: String,
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
            password,
            created_at,
            exp,
            iat,
        }
    }

    pub fn token(&self) -> Result<String, jsonwebtoken::errors::Error> {
        generate_token(self)
    }
}
