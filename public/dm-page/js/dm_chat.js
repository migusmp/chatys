import { WSChat } from "../../js/api/ws_chat.js";
import { GlobalState } from "../../js/state.js";
import { createDmMessageElement } from "./message.js";
import { connectToFriend, getSocketDm, disconnectFromFriend } from "./socketManager.js";
import { setCurrentChatContainer } from './initFriendsMenu.js'; // ✅ Importar correctamente
import { obtainMessagesFromConversation } from "../../js/utils/fetch_api.js";

// Importo la función que obtiene mensajes (añade esta importación si no la tienes)

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

        // === INICIO: Código para actualizar header dinámicamente según online ===

        function updateHeader() {
            const activeFriends = GlobalState.get('active_friends') || [];
            const isOnline = activeFriends.includes(friend.id);
            renderChatHeader(friend, isOnline);
        }

        //updateNotifications(friend.id);

        updateHeader();

        const onActiveFriendsChange = () => updateHeader();
        GlobalState.on('active_friends', onActiveFriendsChange);

        // Limpiar listener al destruir la página
        window.cleanupChatPage = () => {
            GlobalState.off('active_friends', onActiveFriendsChange);
        };

        // === FIN código header ===

        const messagesDiv = container.querySelector('.chat-messages');
        const title = container.querySelector('.chat-title');
        if (title) {
            title.textContent = `Chat con ${friend.username}`;
        }

        // === NUEVO: Cargar y renderizar mensajes ===
        const currentUserId = GlobalState.get("id");

        // Limpio mensajes previos
        if (messagesDiv) messagesDiv.innerHTML = "";

        const messages = await obtainMessagesFromConversation(currentUserId, friend.id);
        if (messages && messages.length > 0) {
            for (const msg of messages) {
                const isMine = msg.sender_id == currentUserId;

                const msgElement = createDmMessageElement({
                    userId: msg.sender_id,
                    user: isMine ? "Tú" : friend.username,
                    image: isMine ? GlobalState.get("image") : friend.image,
                    message: msg.content,
                    isMine,
                    createdAt: msg.created_at,
                });

                messagesDiv.appendChild(msgElement);
            }

            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            // GESTION PARA VER LOS MENSAJES QUE HAN SIDO VISTOS TRAS SER NOTIFICADOS

            const undelivered = GlobalState.get("notifications") || [];

            // Filtrar solo notificaciones de tipo chat_message y de este amigo
            const undeliveredMessages = undelivered.filter(n =>
                n.type_msg === "chat_message" && n.sender_id === friend.id
            );

            // Creamos un Map para buscar rápidamente el undelivered_id por message_id
            const undeliveredMap = new Map();
            undeliveredMessages.forEach(n => {
                undeliveredMap.set(n.message_id, n.undelivered_id);
            });

            // Buscamos el último mensaje entrante que esté en undeliveredMap
            const unreadMessages = messages.filter(msg => 
                msg.sender_id === friend.id && undeliveredMap.has(msg.id || msg.message_id)
            );
            
            for (const msg of unreadMessages) {
                const messageId = msg.id || msg.message_id;
                const undeliveredId = undeliveredMap.get(messageId);
            
                const sent = GlobalState.sendSocketMessage({
                    type_msg: "message_seen",
                    undelivered_id: undeliveredId,
                });
            
                if (!sent) {
                    console.warn(`No se pudo enviar el message_seen para undelivered_id ${undeliveredId}`);
                }
            }

        }
        // === FIN nuevo código mensajes ===

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

function updateNotifications(friend_id) {
    const updated = (GlobalState.get('notifications') || []).filter(
        n => !(n.type_msg === 'chat_message' && n.sender_id === friend_id)
    );
    GlobalState.set('notifications', updated);
}

export function destroyPage() {
    const container = document.getElementById('chat-container');
    if (container) container.innerHTML = '';

    // ✅ Limpiar el estado correctamente
    setCurrentChatContainer(null);
    GlobalState.set("activeChatFriendId", null);

    if (window.cleanupChatPage) {
        window.cleanupChatPage();
        window.cleanupChatPage = null;
    }
}

function renderChatHeader(friend, isOnline) {
    const headerSection = document.querySelector('.chat-dm-header');
    if (!headerSection) return;

    headerSection.innerHTML = ''; // limpiar contenido previo

    const profileContainer = document.createElement('div');
    profileContainer.classList.add('chat-friend-profile');

    // Avatar + status dot
    const avatarWrapper = document.createElement('div');
    avatarWrapper.classList.add('chat-avatar-wrapper');

    const profileImg = document.createElement('img');
    profileImg.src = `/media/user/${friend.image || 'default.png'}`;
    profileImg.alt = `${friend.username} profile`;
    profileImg.classList.add('profileImageDmChat');

    const statusDot = document.createElement('span');
    statusDot.classList.add('chat-status-dot');
    statusDot.classList.add(isOnline ? 'online' : 'offline');

    avatarWrapper.appendChild(profileImg);
    avatarWrapper.appendChild(statusDot);

    // Username + status text
    const usernameStatusWrapper = document.createElement('div');
    usernameStatusWrapper.classList.add('username-status-wrapper');

    const usernameSpan = document.createElement('span');
    usernameSpan.classList.add('username-span-dm');
    usernameSpan.textContent = friend.username;

    const statusText = document.createElement('span');
    statusText.classList.add('status-text-dm');
    statusText.textContent = isOnline ? 'En línea' : 'Desconectado';

    usernameStatusWrapper.appendChild(usernameSpan);
    usernameStatusWrapper.appendChild(statusText);

    profileContainer.appendChild(avatarWrapper);
    profileContainer.appendChild(usernameStatusWrapper);

    headerSection.appendChild(profileContainer);
}
