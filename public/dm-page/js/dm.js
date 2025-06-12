import { goto } from "../../js/router.js";
import { GlobalState } from "../../js/state.js";
import { initChatPage } from "./dm_chat.js";
import { initFriendsMenuDm } from "./initFriendsMenu.js";

export async function initPage(params) {
    console.log("PARAAAMS: ", params);
    
    // Aquí asumimos que params es un objeto tipo { username: "firefox" }
    // o undefined / vacío si no hay parámetro
    const username = params?.username ?? null;

    const sidebar = document.getElementById("sidebar");
    const chatContainer = document.getElementById("chat-container");

    if (!sidebar || !chatContainer) {
        console.error("No se encontraron los contenedores #sidebar o #chat-container");
        return;
    }

    initFriendsMenuDm();

    // Mensaje inicial en el chat
    // chatContainer.innerHTML = `<h2>Selecciona un amigo para chatear</h2>`;
    const friends = GlobalState.get("friends") || [];

    if (username) {
        const friend = friends.find(f => f.username === username);
        if (friend) {
            chatContainer.innerHTML = `<p>Cargando chat...</p>`;  // O spinner
            await loadChat(friend);
        } else {
            chatContainer.innerHTML = `<p>No se encontró al usuario "${username}".</p>`;
        }
    } else {
        chatContainer.innerHTML = `<h2>Selecciona un amigo para chatear</h2>`;
    }
}

export async function loadChat(friend) {
    try {
        console.log("CARGANDO CHAT DE FRIEND:", friend);
        // const username = friend.username; // o friend.id
        // history.pushState({}, '', `/dm/${encodeURIComponent(username)}`);
        await initChatPage(friend); // pasas el friend al chat
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
