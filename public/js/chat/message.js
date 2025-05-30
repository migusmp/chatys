import { GlobalState } from "../state.js";
import { sendFriendRequest } from "../utils/fetch_api.js";

let replyTo = null;  // Puedes exportar si quieres que reply.js lo modifique, o mejor manejarlo en reply.js

export function createMessageElement(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message";
    wrapper.dataset.userid = msg.userId;

    // Nombre de usuario arriba
    const userDiv = document.createElement("div");
    userDiv.className = "username";
    userDiv.textContent = msg.user;

    // Texto del mensaje debajo
    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = msg.message;

    // Aquí podrías añadir el menú de opciones (Responder, Ver perfil, etc)
    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-button";
    menuBtn.innerHTML = "⋮";

    // Dropdown menu (ejemplo simple)
    const menu = document.createElement("div");
    menu.className = "dropdown-menu";

    const friends = GlobalState.get('friends');

    console.log("ID del usuario del mensaje: ", msg.userId);
    console.log("Lista de amigos: ", friends);
    const isFriend = friends.includes(msg.userId) || friends.some(f => f.id === msg.userId);

    console.log("Mi id: ", GlobalState.get('id'));
    console.log("message ID: ", msg.userId);
    const isMyMessage = msg.userId == GlobalState.get('id') ? true : false;
    const isSystemMessage = msg.user == "system";


    const actions = [
        // Ver perfil solo si no es un mensaje del sistema
        !isSystemMessage && {
            label: "Ver perfil", icon: "👤", handler: () => alert("Ver perfil de " + content)
        },
        {
            label: "Responder", icon: "🔁", handler: () => {
                replyTo = content;
                const event = new CustomEvent('reply', { detail: content });
                document.dispatchEvent(event);
            }
        },
        {
            label: "Copiar texto", icon: "📋", handler: () => {
                navigator.clipboard.writeText(content).then(() => alert("Texto copiado"));
            }
        },
        // Añadir amigo solo si no es amigo, no soy yo, y no es mensaje del sistema
        !isSystemMessage && !isFriend && !isMyMessage && {
            label: "Añadir amigo", icon: "🤝", handler: () => {
                sendFriendRequest(wrapper.dataset.userid);
            }
        },
        // Bloquear solo si no soy yo y no es mensaje del sistema
        !isSystemMessage && !isMyMessage && {
            label: "Bloquear usuario", icon: "🚫", handler: () => alert("Usuario bloqueado: " + content)
        }
    ].filter(Boolean);


    actions.forEach(action => {
        const btn = document.createElement("button");
        btn.textContent = `${action.icon} ${action.label}`;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            action.handler();
            menu.classList.remove("show");
        });
        menu.appendChild(btn);
    });

    menuBtn.addEventListener("click", e => {
        e.stopPropagation();
        menu.classList.toggle("show");
    });

    document.addEventListener("click", () => {
        menu.classList.remove("show");
    });

    wrapper.appendChild(userDiv);
    wrapper.appendChild(textDiv);
    wrapper.appendChild(menuBtn);
    wrapper.appendChild(menu);

    return wrapper;
}
