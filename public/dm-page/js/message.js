import { GlobalState } from "../../js/state.js";
import { sendFriendRequest } from "../../js/utils/fetch_api.js";

let replyTo = null;  // Puedes exportar si quieres que reply.js lo modifique, o mejor manejarlo en reply.js

export function createDmMessageElement(msg) {
    // if (typeof msg !== "object" || msg === null) {
    //     msg = { message: String(msg), user: "system", image: "system.jpg", userId: -1 };
    // }

    const wrapper = document.createElement("div");
    wrapper.className = "message" + (msg.isMine ? " my-message" : "");
    wrapper.dataset.userid = msg.userId;

    // Imagen de perfil
    if (!msg.isMine && msg.user !== "system") {
        if (!msg.image) {
            msg.image = "default.png";
        }

        const img = document.createElement("img");
        img.src = '/media/user/' + msg.image;
        img.alt = msg.user + " profile";
        img.className = "message-img";
        wrapper.appendChild(img);
    }

    if (msg.user === "system") {
        msg.image = "system.jpg";
    }

    // Contenedor de texto
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.style.position = "relative";

    const userDiv = document.createElement("div");
    if (!msg.isMine) {
        userDiv.className = "username";
        userDiv.textContent = msg.user;
        contentDiv.appendChild(userDiv);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.style.paddingRight = "50px";  // espacio para la hora
    // textDiv.style.textAlign = "center";   // texto centrado horizontalmente
    textDiv.textContent = msg.message;
    contentDiv.appendChild(textDiv);

    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";

    let date;
    if (msg.createdAt) {
        date = new Date(msg.createdAt);
    } else {
        date = new Date();
    }
    timeDiv.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    contentDiv.appendChild(timeDiv);

    // Botón de menú
    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-button";
    menuBtn.innerHTML = "⋮";

    // Menú desplegable
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

    // Estructura de fila horizontal
    const row = document.createElement("div");
    row.className = "message-row";
    row.appendChild(contentDiv);

    if (!msg.isMine) {
        const menuWrapper = document.createElement("div");
        menuWrapper.className = "message-menu-wrapper";
        menuWrapper.appendChild(menuBtn);
        menuWrapper.appendChild(menu);
        row.appendChild(menuWrapper);
    }

    wrapper.appendChild(row);
    return wrapper;
}