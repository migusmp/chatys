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

    const actions = [
        { label: "Ver perfil", icon: "👤", handler: () => alert("Ver perfil de " + content) },
        {
            label: "Añadir amigo", icon: "🤝", handler: () => {
                sendFriendRequest(wrapper.dataset.userid)
            }
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
        { label: "Bloquear usuario", icon: "🚫", handler: () => alert("Usuario bloqueado: " + content) }
    ];

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
