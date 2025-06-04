import { goto } from "../../js/router.js"; // Solo si lo usas para otras cosas
import { initChatPage } from "./dm_chat.js";

export async function initPage() {
    const sidebar = document.getElementById("sidebar");
    const chatContainer = document.getElementById("chat-container");

    if (!sidebar || !chatContainer) {
        console.error("No se encontraron los contenedores #sidebar o #chat-container");
        return;
    }

    // Simular una lista de amigos
    const friends = [
        { username: "juan", displayName: "Juan Pérez" },
        { username: "ana", displayName: "Ana López" },
        { username: "mario", displayName: "Mario Ruiz" }
    ];

    sidebar.innerHTML = "<h2>Amigos</h2>";

    friends.forEach(friend => {
        const div = document.createElement("div");
        div.className = "friend";
        div.textContent = friend.displayName;
        div.style.cursor = "pointer";
        div.addEventListener("click", () => {
            loadChat(friend.username);
        });
        sidebar.appendChild(div);
    });

    // Mensaje inicial en el chat
    chatContainer.innerHTML = `<h2>Selecciona un amigo para chatear</h2>`;
}

// Aquí llamas directamente a initPage de dm_chat.js
async function loadChat(username) {
    try {
        await initChatPage({ username }); // pasas el username como parámetro
    } catch (err) {
        const chatContainer = document.getElementById("chat-container");
        if (chatContainer) {
            chatContainer.innerHTML = `<p>Error cargando el chat: ${err.message}</p>`;
        }
    }
}

export function destroyPage() {
    const sidebar = document.getElementById("sidebar");
    const chatContainer = document.getElementById("chat-container");

    if (sidebar) sidebar.innerHTML = "";
    if (chatContainer) chatContainer.innerHTML = "";
}

// Función para cargar el chat dinámicamente
// async function loadChat(username) {
//     const chatContainer = document.getElementById("chat-container");
//     try {
//         const res = await fetch('/static/dm-page/html/dm_chat.html');
//         if (!res.ok) throw new Error("No se pudo cargar el chat");

//         const html = await res.text();
//         chatContainer.innerHTML = html;

//         // Personaliza el título del chat con el username
//         const titleElem = chatContainer.querySelector('.chat-title');
//         if (titleElem) {
//             titleElem.textContent = `Chat con ${username}`;
//         }

//         // Aquí puedes inicializar más cosas del chat, listeners, etc.

//     } catch (err) {
//         chatContainer.innerHTML = `<p>Error cargando el chat: ${err.message}</p>`;
//     }
// }

// export function destroyPage() {
//     // Si quieres limpiar algo cuando sales de esta página
//     const sidebar = document.getElementById("sidebar");
//     const chatContainer = document.getElementById("chat-container");

//     if (sidebar) sidebar.innerHTML = "";
//     if (chatContainer) chatContainer.innerHTML = "";
// }