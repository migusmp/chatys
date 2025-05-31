import { GlobalState } from "./state.js";
import { startApp } from "./utils/fetch_api.js";

const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

document.addEventListener('DOMContentLoaded', () => {
    const socket = new WebSocket(`${protocol}://${location.host}/ws`);

    socket.onopen = () => {
        console.log('Conexión WebSocket establecida');
        // Por ejemplo, enviar un mensaje al servidor al conectarte:
        // socket.send(JSON.stringify({ type: 'hello', payload: 'Hola servidor' }));
    };

    socket.onmessage = (event) => {
        console.log('Mensaje recibido del servidor:', event.data);
        try {
            let msg = JSON.parse(event.data);
            if (msg.type_msg === 'FR') {
                GlobalState.addNotification(msg);
            }
        } catch (e) {
            console.error('Error al parsear JSON:', e);
        }
    };

    socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
    };

    // Recibir la data del profile
    startApp();

    // Si quieres cerrar el socket cuando se cierre la pestaña
    //window.addEventListener('beforeunload', () => {
    //    if (socket.readyState === WebSocket.OPEN) {
    //        socket.close();
    //    }
    //});
});
