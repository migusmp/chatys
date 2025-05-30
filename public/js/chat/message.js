import { GlobalState } from "../state.js";
import { sendFriendRequest } from "../utils/fetch_api.js";

let replyTo = null;  // Puedes exportar si quieres que reply.js lo modifique, o mejor manejarlo en reply.js

export function createMessageElement(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message";
    wrapper.dataset.userid = msg.userId;

    // Imagen de perfil
    if (!msg.imagen) {
        msg.imagen = "default.png"; // Imagen por defecto si no hay imagen
    }
    if (msg.user === "system") {
        msg.imagen = "system.jpg"; // Imagen para mensajes del sistema
    }
    
    const img = document.createElement("img");
    img.src = '/media/user/' + msg.imagen;
    img.alt = msg.user + " profile";
    img.className = "message-img";
    wrapper.appendChild(img);

    // Contenedor de texto para username y mensaje
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    // Nombre de usuario arriba
    const userDiv = document.createElement("div");
    userDiv.className = "username";
    userDiv.textContent = msg.user;

    // Texto del mensaje debajo
    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = msg.message;

    contentDiv.appendChild(userDiv);
    contentDiv.appendChild(textDiv);

    // Botón menú opciones
    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-button";
    menuBtn.innerHTML = "⋮";

    // Dropdown menu
    const menu = document.createElement("div");
    menu.className = "dropdown-menu";

    const friends = GlobalState.get('friends');
    const isFriend = friends.includes(msg.userId) || friends.some(f => f.id === msg.userId);
    const isMyMessage = msg.userId == GlobalState.get('id');
    const isSystemMessage = msg.user == "system";

    const actions = [
        !isSystemMessage && {
            label: "Ver perfil", icon: "👤", handler: () => alert("Ver perfil de " + msg.user)
        },
        {
            label: "Responder", icon: "🔁", handler: () => {
                replyTo = msg;
                const event = new CustomEvent('reply', { detail: msg });
                document.dispatchEvent(event);
            }
        },
        {
            label: "Copiar texto", icon: "📋", handler: () => {
                navigator.clipboard.writeText(msg.message).then(() => alert("Texto copiado"));
            }
        },
        !isSystemMessage && !isFriend && !isMyMessage && {
            label: "Añadir amigo", icon: "🤝", handler: () => {
                sendFriendRequest(wrapper.dataset.userid);
            }
        },
        !isSystemMessage && !isMyMessage && {
            label: "Bloquear usuario", icon: "🚫", handler: () => alert("Usuario bloqueado: " + msg.user)
        }
    ].filter(Boolean);

    actions.forEach(action => {
        const btn = document.createElement("button");
        btn.textContent = `${action.icon} ${action.label}`;
        btn.addEventListener("click", e => {
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

    wrapper.appendChild(contentDiv);
    wrapper.appendChild(menuBtn);
    wrapper.appendChild(menu);

    return wrapper;
}
