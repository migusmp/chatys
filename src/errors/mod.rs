use crate::utils::responses::ErrorResponse;
use axum::{http::StatusCode, response::IntoResponse, Json};

pub enum AppError {
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
    UserNotFound,
    MessageNotFound,
    CreateConversationError,
    AuthCookieNotFound,
    NoneCookieFound,
    Unauthorized,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, err_type, err_msg) = match self {
            AppError::UsernameInvalid => (
                StatusCode::BAD_REQUEST,
                "USERNAME_INVALID",
                "Invalid username",
            ),
            AppError::UsernameEmpty => (
                StatusCode::BAD_REQUEST,
                "USERNAME_EMPTY",
                "You must enter a username",
            ),
            AppError::NameEmpty => (
                StatusCode::BAD_REQUEST,
                "NAME_EMPTY",
                "You must enter a name",
            ),
            AppError::InvalidEmail => (StatusCode::BAD_REQUEST, "EMAIL_INVALID", "Invalid email"),
            AppError::ShortPassword => (
                StatusCode::BAD_REQUEST,
                "SHORT_PASSWORD",
                "Password is too short",
            ),
            AppError::UserAlreadyExists => (
                StatusCode::CONFLICT,
                "USER_ALREADY_EXISTS",
                "User already exists",
            ),
            AppError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Internal error",
            ),
            AppError::InvalidImageSize => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "IMAGE_TOO_LARGE",
                "Image exceeds the maximum allowed size of 5MB.",
            ),
            AppError::InvalidFriendRequest => (
                StatusCode::BAD_REQUEST,
                "INVALID_FRIEND_REQUEST",
                "You can't add yourself as a friend",
            ),
            AppError::InvalidParameter => (
                StatusCode::BAD_REQUEST,
                "INVALID_PARAMETER",
                "Invalid parameter provided in request",
            ),
            AppError::DuplicateFriendRequest => (
                StatusCode::CONFLICT,
                "DUPLICATE_FRIEND_REQUEST",
                "You requested friendship before",
            ),
            AppError::NoFriendRequestFound => (
                StatusCode::BAD_REQUEST,
                "NO_FRIEND_REQUEST_FOUND",
                "No friend request found",
            ),
            AppError::InvalidImageFormat => (
                StatusCode::BAD_REQUEST,
                "INVALID_IMAGE_FORMAT",
                "Invalid image format",
            ),
            AppError::ErrorPasswordUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "ERROR_PASSWORD_UPDATE",
                "Error updating password",
            ),
            AppError::ErrorEmailUpdate => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "ERROR_EMAIL_UPDATE",
                "Error updating email",
            ),
            AppError::EmailExists => (
                StatusCode::BAD_REQUEST,
                "EMAIL_EXISTS",
                "Email already exists",
            ),
            AppError::AlreadyFriends => (
                StatusCode::OK,
                "ALREADY_FRIENDS",
                "You are already friends with this user",
            ),
            AppError::BadParameter => (
                StatusCode::BAD_REQUEST,
                "BAD_PARAMETER",
                "Bad parameter provided in request",
            ),
            AppError::OnlyOneFileAllowed => (
                StatusCode::BAD_REQUEST,
                "ONLY_ONE_FILE_ALLOWED",
                "You can upload one file at the same time!",
            ),
            AppError::FileTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "FILE_TO_LARGE",
                "The uploaded file is too large. Maximum allowed size is 5 MB",
            ),
            AppError::UserNotFound => (StatusCode::NOT_FOUND, "USER_NOT_FOUND", "User not found"),
            AppError::MessageNotFound => {
                (StatusCode::NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found")
            }
            AppError::CreateConversationError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "CREATE_CONVERSATION_ERROR",
                "Error creating conversation",
            ),
            AppError::AuthCookieNotFound => (
                StatusCode::UNAUTHORIZED,
                "AUTH_COOKIE_NOT_FOUND",
                "Authentication cookie not found",
            ),
            AppError::NoneCookieFound => (
                StatusCode::UNAUTHORIZED,
                "NO_COOKIE_FOUND",
                "No cookies found in request",
            ),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "Unauthorized"),
        };

        let body = Json(ErrorResponse {
            status: "error".to_string(),
            r#type: err_type.to_string(),
            message: err_msg.to_string(),
        });

        (status, body).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(_value: sqlx::Error) -> Self {
        AppError::InternalError
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(value: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind;

        match value.kind() {
            ErrorKind::ExpiredSignature | ErrorKind::InvalidToken | ErrorKind::InvalidSignature => {
                AppError::Unauthorized
            }
            _ => AppError::InternalError,
        }
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(_value: bcrypt::BcryptError) -> Self {
        AppError::ErrorPasswordUpdate
    }
}
