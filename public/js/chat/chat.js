import { WSChat } from '/static/js/ws_chat.js';
import { createMessageElement } from './message.js';
import { setupReplyFeature } from './reply.js';

const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");

const title = document.getElementById("roomTitle");
const chatContainer = document.getElementById("chatContainer");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

let socket = null;

if (!roomName) {
    title.textContent = "Sala no especificada.";
    sendButton.disabled = true;
} else {
    title.textContent = `Sala: ${roomName}`;

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
        const msgElement = createMessageElement(msg);
        chatContainer.appendChild(msgElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

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
