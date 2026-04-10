use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};

use axum::extract::ws::Message;
use serde::Serialize;
use tokio::sync::broadcast;

const BROADCAST_CAPACITY: usize = 100;

#[derive(Default)]
pub struct ChatState {
    pub rooms: HashMap<String, Room>, // Mapa de salas donde la clave es el room_id y el valor es un canal broadcast
}

#[derive(Clone)]
pub struct Room {
    pub broadcaster: broadcast::Sender<Message>,
    pub user_count: Arc<AtomicUsize>,
    pub description: Option<String>,
    pub image: Option<String>,
    /// Conversation ID linked to this room for message persistence.
    /// None for rooms that haven't been initialised with DB persistence yet.
    pub conversation_id: Option<i32>,
}

/// Snapshot of a room sent over the active-rooms WebSocket.
#[derive(Serialize, Clone)]
pub struct RoomInfo {
    pub name: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub users: usize,
}

impl ChatState {
    /// Creates a new room with optional metadata.
    /// Silently ignores duplicate names — the in-memory state mirrors the DB's
    /// ON CONFLICT DO NOTHING behaviour.
    pub fn create_room(
        &mut self,
        room_id: String,
        description: Option<String>,
        image: Option<String>,
    ) {
        if self.rooms.contains_key(&room_id) {
            return;
        }
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        self.rooms.insert(
            room_id,
            Room {
                broadcaster: tx,
                user_count: Arc::new(AtomicUsize::new(0)),
                description,
                image,
                conversation_id: None,
            },
        );
    }

    /// Creates a room and immediately associates it with a DB conversation.
    pub fn create_room_with_conversation(
        &mut self,
        room_id: String,
        description: Option<String>,
        image: Option<String>,
        conversation_id: i32,
    ) {
        if self.rooms.contains_key(&room_id) {
            // Room already exists — just set the conversation_id if missing
            if let Some(room) = self.rooms.get_mut(&room_id) {
                if room.conversation_id.is_none() {
                    room.conversation_id = Some(conversation_id);
                }
            }
            return;
        }
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        self.rooms.insert(
            room_id,
            Room {
                broadcaster: tx,
                user_count: Arc::new(AtomicUsize::new(0)),
                description,
                image,
                conversation_id: Some(conversation_id),
            },
        );
    }

    // Un usuario se une a la sala y obtiene un receiver
    pub fn join_room(&mut self, room_id: &str) -> broadcast::Receiver<Message> {
        let room = self.rooms.entry(room_id.to_string()).or_insert_with(|| {
            let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
            Room {
                broadcaster: tx,
                user_count: Arc::new(AtomicUsize::new(0)),
                description: None,
                image: None,
                conversation_id: None,
            }
        });

        // Incrementar contador atómicamente
        room.user_count.fetch_add(1, Ordering::SeqCst);

        room.broadcaster.subscribe()
    }

    // Un usuario sale de la sala: decrementamos contador
    pub fn leave_room(&mut self, room_id: &str) {
        if let Some(room) = self.rooms.get(room_id) {
            room.user_count.fetch_sub(1, Ordering::SeqCst);
        }
    }

    // Obtener número de usuarios conectados
    pub fn get_room_user_count(&self, room_id: &str) -> Option<usize> {
        self.rooms
            .get(room_id)
            .map(|room| room.user_count.load(Ordering::SeqCst))
    }

    /// Returns metadata + live user count for every active room.
    pub fn active_rooms(&self) -> Vec<RoomInfo> {
        self.rooms
            .iter()
            .map(|(name, room)| RoomInfo {
                name: name.clone(),
                description: room.description.clone(),
                image: room.image.clone(),
                users: room.user_count.load(Ordering::SeqCst),
            })
            .collect()
    }

    // Enviar mensaje a todos los suscriptores de una sala
    pub fn send_to_room(&self, room_id: &str, msg: Message) {
        if let Some(room) = self.rooms.get(room_id) {
            let _ = room.broadcaster.send(msg);
        }
    }

    /// Returns the conversation_id for a room, if set.
    pub fn get_room_conversation_id(&self, room_id: &str) -> Option<i32> {
        self.rooms
            .get(room_id)
            .and_then(|room| room.conversation_id)
    }
}
