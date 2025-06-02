import { WSChat } from '/static/js/api/ws_chat.js';
import { createMessageElement } from './message.js';
import { setupReplyFeature } from './reply.js';
import { GlobalState } from '../state.js';
import { goto } from '../router.js';


let socket = null; // <- lo subimos fuera de initPage
let currentRoomId = null;

export async function initPage(params) {
    const roomName = params.roomId;
    currentRoomId = roomName;
    console.log("INICIANDO CHAAAT");

    const title = document.getElementById("roomTitle");
    const chatContainer = document.getElementById("chatContainer");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");

    await GlobalState.init();

    if (!roomName) {
        if (title) title.textContent = "Sala no especificada. Redirigiendo...";
        setTimeout(() => goto("/"), 2000);
        return;
    }

    if (title) title.textContent = `Sala: ${roomName}`;

    socket = WSChat.joinRoom(roomName);

    const previousMessages = WSChat.getMessages(roomName);
    for (const msg of previousMessages) {
        const message = `${msg.user}: ${msg.message}`;
        const msgElement = createMessageElement(message);
        chatContainer.appendChild(msgElement);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

    socket.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        console.log("MENSAJE ENTRANTE DESDE EL SERVIDOR: ", msg);
        const currentUsername = GlobalState.get('username');
        const displayName = msg.user === currentUsername ? 'Tú' : msg.user;

        const msgElement = createMessageElement({
            userId: msg.userId,
            user: displayName,
            image: msg.image,
            message: msg.message
        });

        chatContainer.appendChild(msgElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    sendButton.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (text && socket) {
            socket.send(text);
            messageInput.value = "";
        }
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendButton.click();
        }
    });

    setupReplyFeature();
}

export function destroyPage() {
    console.log("Saliendo de sala:", currentRoomId);

    if (currentRoomId) {
        WSChat.leaveRoom(currentRoomId);
        console.log("🛑 Sockets cerrados para la sala:", currentRoomId);
        currentRoomId = null;
    }
}

export async function loadChatPage(params) {
    const container = document.getElementById('app');
  
    // Inyecta la estructura HTML necesaria para la página de chat
    container.innerHTML = `
      <h1 id="roomTitle"></h1>
      <div id="chatContainer" style="height: 300px; overflow-y: auto; border: 1px solid #ccc;"></div>
      <input id="messageInput" type="text" placeholder="Escribe un mensaje..." />
      <button id="sendButton">Enviar</button>
    `;
  
    // Ahora que ya está en el DOM, llamamos a initPage con los params
    await initPage(params);
  }
