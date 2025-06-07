import { connectToFriend } from './socketManager.js'; // ruta según tu estructura
import { GlobalState } from "../../js/state.js";
import { loadChat } from "./dm.js";
import { createDmMessageElement } from './message.js';
import { goto } from '../../js/router.js';

export let currentChatContainer = null;

export function setCurrentChatContainer(el) {
    currentChatContainer = el;
}
export function getCurrentChatContainer() {
    return currentChatContainer;
}

export function initFriendsMenuDm() {
    const friendsSection = document.getElementById("sidebar");
    let friendsList = friendsSection.querySelector("ul");

    if (!friendsList) {
        friendsList = document.createElement("ul");
        friendsSection.appendChild(friendsList);
    }

    friendsList.className = "friend-list";

    // Listener global que se conecta una sola vez
    function handleIncomingMessageGlobal(msg) {
        console.log("MENSAJE QUE ACABA DE LLEGAR: ", msg);
        const activeFriendId = GlobalState.get("activeChatFriendId");
        const currentUserId = GlobalState.get("id");
    
        if (msg.from_user !== activeFriendId && msg.to_user !== activeFriendId) {
            // Puedes mostrar notificaciones aquí si quieres
            return;
        }

        const currentChatContenedor = getCurrentChatContainer();
        if (!currentChatContenedor) return;
    
        const messagesDiv = currentChatContenedor.querySelector('.chat-messages');
        const isMine = msg.from_user == currentUserId;
    
        const msgElement = createDmMessageElement({
            userId: msg.from_user,
            user: isMine ? 'Tú' : msg.from_username,
            image: msg.from_username_image,
            message: msg.content,
            isMine,
        });
    
        messagesDiv.appendChild(msgElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function renderFriends() {
        const friends = GlobalState.get('friends') || [];
        const activeFriends = GlobalState.get('active_friends') || [];

        friendsList.innerHTML = "";

        if (friends.length === 0) {
            const li = document.createElement("li");
            li.className = "friend-empty";
            li.textContent = "Aún no tienes amigos";
            friendsList.appendChild(li);
            return;
        }

        const sortedFriends = [...friends].sort((a, b) => {
            const aActive = activeFriends.includes(a.id);
            const bActive = activeFriends.includes(b.id);
            return (aActive === bActive) ? 0 : aActive ? -1 : 1;
        });

        for (const friend of sortedFriends) {
            const isActive = activeFriends.includes(friend.id);
        
            if (isActive) {
                connectToFriend(friend.id, handleIncomingMessageGlobal);
            }
        
            // 💡 Aquí filtramos las notificaciones no leídas para este amigo
            const notifications = GlobalState.get('notifications') || [];
            const unreadCount = notifications.filter(
                n => n.type_msg === 'chat_message' && n.sender_id === friend.id
            ).length;
        
            const li = document.createElement("li");
            li.className = "friend-item";
        
            const friendData = {
                ...friend,
                isActive
            };
        
            li.addEventListener("click", () => {
                // Al hacer clic, podrías limpiar las notificaciones del usuario clicado
                const updated = (GlobalState.get('notifications') || []).filter(
                    n => !(n.type_msg === 'chat_message' && n.sender_id === friend.id)
                );
                GlobalState.set('notifications', updated);
        
                goto(`/dm/${friend.username}`);
                loadChat(friendData);
                connectToFriend(friend.id, handleIncomingMessageGlobal);
            });
        
            const imgWrapper = document.createElement("div");
            imgWrapper.className = "friend-avatar-wrapper";
        
            const img = document.createElement("img");
            img.className = "friend-avatar";
            img.src = `/media/user/${friend.image}`;
            img.alt = `${friend.username}`;
            img.width = 32;
            img.height = 32;
        
            const statusDot = document.createElement("div");
            statusDot.className = "friend-status";
            if (isActive) statusDot.classList.add("online");
        
            imgWrapper.appendChild(img);
            imgWrapper.appendChild(statusDot);
        
            const span = document.createElement("span");
            span.className = "friend-username";
            span.textContent = friend.username;
            
            // 🔴 Aquí creamos el círculo rojo con contador si hay mensajes no leídos
            if (unreadCount > 0) {
                const notificationBadge = document.createElement("div");
                notificationBadge.className = "notification-badge";
                notificationBadge.textContent = unreadCount;
                li.appendChild(notificationBadge);
            }
        
            li.appendChild(imgWrapper);
            li.appendChild(span);
        
            friendsList.appendChild(li);
        }
    }

    renderFriends();

    GlobalState.on('active_friends', renderFriends);
    GlobalState.on('friends', renderFriends);
    GlobalState.on('notifications', renderFriends);
}
