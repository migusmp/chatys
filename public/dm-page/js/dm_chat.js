import { WSChat } from "../../js/api/ws_chat.js";
import { GlobalState } from "../../js/state.js";
import { createDmMessageElement } from "./message.js";

let socket = null;

export async function initChatPage(friend) {

    // INICIAR CONEXION WEBSOCKET CON SALA.
    socket = WSChat.joinChat(friend.id);

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

        // Inserta el HTML en el contenedor
        container.innerHTML = chatDiv.outerHTML;
        const headerSection = document.querySelector(".chat-dm-header");
        if (headerSection) {
            const profileContainer = document.createElement('div');
            profileContainer.classList.add('chat-friend-profile');
            profileContainer.style.display = 'flex';
            profileContainer.style.alignItems = 'center';
            profileContainer.style.gap = '0.5rem';
        
            const profileImg = document.createElement('img');
            profileImg.src = `/media/user/${friend.image}`; // Usa una imagen por defecto si no hay
            profileImg.alt = `${friend.username} profile`;
            profileImg.style.width = '40px';
            profileImg.style.height = '40px';
            profileImg.style.borderRadius = '50%';
            profileImg.style.objectFit = 'cover';
        
            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = friend.username;
            usernameSpan.style.fontWeight = 'bold';
        
            profileContainer.appendChild(profileImg);
            profileContainer.appendChild(usernameSpan);
        
            headerSection.appendChild(profileContainer);
        }
        

        const messagesDiv = container.querySelector('.chat-messages');

        // Actualiza el título y los mensajes
        const title = container.querySelector('.chat-title');
        if (title) {
            title.textContent = `Chat con ${friend.username}`;
            console.log("Título actualizado a:", title.textContent);
        }

        // CUANDO SE RECIBE UN MENSAJE SE DEBE DE CREAR
        socket.addEventListener("message", (e) => {
            
            const msg = JSON.parse(e.data);
            console.log("NUEVO MENSAJEEE:",msg);
            const currentUserId = GlobalState.get('id');
            const isMine = msg.from_user == currentUserId;

            const msgElement = createDmMessageElement({
                userId: msg.from_user,
                user: isMine ? 'Tú' : msg.from_username,
                image: msg.from_username_image,
                message: msg.content,
                isMine: isMine,    
            })

            messagesDiv.appendChild(msgElement);
        })

        const sendButton = container.querySelector('#sendButton');
        const messageInput = container.querySelector('#messageInput');

        if (sendButton && messageInput) {
            sendButton.addEventListener('click', () => {
                const msg = messageInput.value.trim();
                if (msg !== '') {
                    WSChat.sendMessageToFriend(friend.id, msg);
                    messageInput.value = ''; // Limpiar input después de enviar
                }
            });
        
            messageInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Por si es un <textarea>, evita saltos de línea
                    const msg = messageInput.value.trim();
                    if (msg !== '') {
                        WSChat.sendMessageToFriend(friend.id, msg);
                        messageInput.value = ''; // Limpiar input después de enviar
                    }
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
}