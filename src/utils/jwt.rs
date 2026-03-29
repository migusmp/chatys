use jsonwebtoken::errors::Result;
use jsonwebtoken::{encode, EncodingKey, Header};
use std::sync::OnceLock;

use crate::models::user::Payload;

static JWT_SECRET: OnceLock<String> = OnceLock::new();

pub fn init_jwt_secret(secret: String) {
    JWT_SECRET
        .set(secret)
        .expect("JWT secret already initialized");
}

pub fn get_jwt_secret() -> &'static str {
    JWT_SECRET.get().expect("JWT secret not initialized")
}

pub fn generate_token(payload: &Payload) -> Result<String> {
    let token = encode(
        &Header::default(),
        payload,
        &EncodingKey::from_secret(get_jwt_secret().as_ref()),
    )?;

    Ok(token)
}
