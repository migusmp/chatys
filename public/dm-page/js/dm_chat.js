export async function initChatPage(params) {
    const { username } = params;
    console.log("USERNAMEEE", username);

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

        // Aquí pones el log para verificar
        console.log("Contenido insertado:", container.innerHTML);

        // Actualiza el título y los mensajes
        const title = container.querySelector('.chat-title');
        if (title) {
            title.textContent = `Chat con ${username}`;
            console.log("Título actualizado a:", title.textContent);
          }

        const messages = container.querySelector('.chat-messages');
        if (messages) {
            messages.innerHTML = `
          <p><strong>${username}:</strong> Hola!</p>
          <p><strong>Tú:</strong> ¿Qué tal?</p>
        `;
        }
    } catch (err) {
        console.error("Error cargando la plantilla de chat:", err);
    }
}


export function destroyPage() {
    const container = document.getElementById('chat-container');
    if (container) container.innerHTML = '';
}