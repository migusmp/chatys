pub mod chat;
pub mod server;
pub mod user;

#[derive(sqlx::FromRow)]
pub struct InsertedFriendRequest {
    pub id: i32,
    pub created_at: chrono::NaiveDateTime,
}
