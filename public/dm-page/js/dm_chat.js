import { WSChat } from "../../js/api/ws_chat.js";
import { GlobalState } from "../../js/state.js";
import { createDmMessageElement } from "./message.js";
import { connectToFriend, getSocketDm, disconnectFromFriend } from "./socketManager.js";
import { setCurrentChatContainer } from './initFriendsMenu.js'; // ✅ Importar correctamente

let socket = null;

export async function initChatPage(friend) {
    const container = document.getElementById('chat-container');
    if (!container) {
        console.error("No se encontró el contenedor #chat-container");
        return;
    }

    try {
        const res = await fetch('/static/dm-page/html/dm_chat.html');
        const htmlText = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const chatDiv = doc.querySelector('.chat');

        container.innerHTML = chatDiv.outerHTML;

        const messagesDiv = container.querySelector('.chat-messages');
        const title = container.querySelector('.chat-title');
        if (title) {
            title.textContent = `Chat con ${friend.username}`;
        }

        // ✅ Guardar contenedor usando setter
        setCurrentChatContainer(container);
        GlobalState.set("activeChatFriendId", friend.id);

        const sendButton = container.querySelector('#sendButton');
        const messageInput = container.querySelector('#messageInput');

        // Estado del botón
        function updateSendButton() {
            sendButton.disabled = false; // Asumimos que el socket global está conectado
        }

        updateSendButton();

        if (sendButton && messageInput) {
            const sendMessage = () => {
                const msg = messageInput.value.trim();
                if (msg !== '') {
                    WSChat.sendMessageToFriend(friend.id, msg);
                    messageInput.value = '';
                }
            };

            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage();
                }
            });
        }

    } catch (err) {
        console.error("Error cargando la plantilla de chat:", err);
    }
}

export function destroyPage() {
    const container = document.getElementById('chat-container');
    if (container) container.innerHTML = '';

    // ✅ Limpiar el estado correctamente
    setCurrentChatContainer(null);
    GlobalState.set("activeChatFriendId", null);
}
