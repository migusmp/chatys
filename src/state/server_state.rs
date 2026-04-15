use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

// Message type reused from the WS broadcast — axum's WebSocket message type,
// same as what ChatState/Room use in models/chat.rs.
use axum::extract::ws::Message;

/// Per-channel broadcast senders for server channel WebSockets.
/// Keyed by channel UUID. Created lazily on first subscriber.
pub struct ServerState {
    pub channels: DashMap<Uuid, broadcast::Sender<Message>>,
}

impl ServerState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            channels: DashMap::new(),
        })
    }

    /// Get existing sender or create one with capacity 1000 (same as rooms)
    pub fn get_or_create_sender(&self, channel_id: Uuid) -> broadcast::Sender<Message> {
        if let Some(sender) = self.channels.get(&channel_id) {
            return sender.clone();
        }
        let (tx, _) = broadcast::channel(1000);
        self.channels.insert(channel_id, tx.clone());
        tx
    }
}
