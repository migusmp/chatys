import { WSChat } from './ws_chat.js';

const totalRoomsDiv = document.getElementById("totalRooms");
const activeRoomsDiv = document.getElementById("activeRooms");
const activeUsersDiv = document.getElementById("usersActive");


document.addEventListener('DOMContentLoaded', () => {
    WSChat.connectGeneralStats((stats) => {
        // Actualiza el DOM con los datos recibidos
        totalRoomsDiv.textContent = stats.totalRooms;
        activeRoomsDiv.textContent = stats.activeRooms.length;
        activeUsersDiv.textContent = stats.activeUsers || 0;
        renderActiveRooms(stats.activeRooms);
    });
    const socket = new WebSocket(`ws://${location.host}/ws`);

    socket.onopen = () => {
        console.log('Conexión WebSocket establecida');
        // Por ejemplo, enviar un mensaje al servidor al conectarte:
        // socket.send(JSON.stringify({ type: 'hello', payload: 'Hola servidor' }));
    };

    socket.onmessage = (event) => {
        console.log('Mensaje recibido del servidor:', event.data);
        // Aquí puedes actualizar la UI con la info recibida
    };

    socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
    };

    // Actualizar los contadores al cargar la página
    activeRoomsDiv.textContent = WSChat.getGeneralStats() ? WSChat.getGeneralStats().activeRooms : 'Cargando...';
    const joinBtn = document.getElementById("joinRoomBtn");
    const roomInput = document.getElementById("roomNameInput");

    joinBtn.addEventListener("click", () => {
        if (!roomInput.value.trim()) {
            alert("Por favor, ingresa un nombre de sala.");
            return;
        }
        window.location.href = `static/chat.html?room=${encodeURIComponent(roomInput.value.trim())}`;
        roomInput.value = ""; // Limpiar el input después de unirse
    });

});

const roomsContainer = document.getElementById("roomsContainer");

// Renderizar salas
function renderActiveRooms(rooms) {
    const container = document.getElementById("roomsContainer");
    container.innerHTML = ""; // Limpiar antes de volver a pintar
    if (rooms.length === 0) {
        container.innerHTML = "<p>No hay salas activas.</p>";
        return;
    }
    rooms.forEach((room) => {
        const card = document.createElement("div");
        card.className = "room-card";

        card.innerHTML = `
        <h3>${room.name}</h3>
        <p>Usuarios: ${room.users}</p>
        <button>Unirse</button>
      `;

        // Añadir evento al botón "Unirse"
        const joinButton = card.querySelector("button");
        joinButton.addEventListener("click", () => {
            WSChat.joinRoom(room.name); // Esta función debe existir ya en tu código
            window.location.href = `static/chat.html?room=${encodeURIComponent(room.name)}`;
        });;

        container.appendChild(card);
    });
}
console.log("Renderizando salas activas...");
console.log(WSChat.getGeneralStats() ? WSChat.getGeneralStats().activeRooms : []);

// Puedes llamarlo cuando recibas las salas activas del servidor:
renderActiveRooms(WSChat.getGeneralStats() ? WSChat.getGeneralStats() : []);