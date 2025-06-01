import { WSChat } from "../api/ws_chat.js";
import { goto } from "../router.js";

export function renderChatStats(stats) {
    const totalRoomsElem = document.getElementById("totalRooms");
    const activeRoomsElem = document.getElementById("activeRooms");
    const usersActiveElem = document.getElementById("usersActive");
    // let txt = "";

    // stats.activeRooms.forEach(room => {
    //     txt += room.name + ' | ';
    // });

    if (totalRoomsElem) totalRoomsElem.textContent = stats.totalRooms;
    if (activeRoomsElem) activeRoomsElem.textContent = stats.activeRooms.length;
    if (usersActiveElem) usersActiveElem.textContent = stats.activeUsers;
}

export function renderActiveRooms(rooms) {
    
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
            // window.location.href = `static/chat.html?room=${encodeURIComponent(room.name)}`;
            goto(`/chats/${room.name}`);

        });

        container.appendChild(card);
    });
}

