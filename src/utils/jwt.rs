use jsonwebtoken::errors::Result;
use jsonwebtoken::{encode, EncodingKey, Header};

use crate::models::user::Payload;

pub fn generate_token(payload: &Payload) -> Result<String> {
    let token = encode(
        &Header::default(),
        payload,
        &EncodingKey::from_secret("sdadakj_19234ÑpoM14I83_.,@?¿98".as_ref()),
    )?;

    Ok(token)
}
