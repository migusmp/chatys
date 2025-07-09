use std::{collections::HashMap, sync::{atomic::{AtomicUsize, Ordering}, Arc}};

use axum::extract::ws::Message;
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
}

impl ChatState {
    // Crear una nueva sala
    pub fn create_room(&mut self, room_id: String) {
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        self.rooms.insert(room_id, Room { 
            broadcaster: tx,
            user_count: Arc::new(AtomicUsize::new(0)),
        });
    }

    // Un usuario se une a la sala y obtiene un receiver
    pub fn join_room(&mut self, room_id: &str) -> broadcast::Receiver<Message> {
        let room = self.rooms.entry(room_id.to_string()).or_insert_with(|| {
            let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
            Room { 
                broadcaster: tx,
                user_count: Arc::new(AtomicUsize::new(0)),
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
        self.rooms.get(room_id).map(|room| room.user_count.load(Ordering::SeqCst))
    }

    // Listado de salas activas
    pub fn active_rooms(&self) -> Vec<String> {
        self.rooms.keys().cloned().collect()
    }

    // Enviar mensaje a todos los suscriptores de una sala
    pub fn send_to_room(&self, room_id: &str, msg: Message) {
        if let Some(room) = self.rooms.get(room_id) {
            let _ = room.broadcaster.send(msg);
        }
    }
}