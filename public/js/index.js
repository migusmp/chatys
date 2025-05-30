import { GlobalState } from "./state.js";
import { startApp } from "./utils/fetch_api.js";

document.addEventListener('DOMContentLoaded', () => {
    const socket = new WebSocket(`ws://${location.host}/ws`);

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
        // Aquí puedes actualizar la UI con la info recibida
    };

    socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
    };

    // Recibir la data del profile
    GlobalState.init().then(() => {
        // Aquí puedes hacer algo con el estado global, como mostrar el perfil del usuario
        console.log("Estado global inicializado");
    });

    // Si quieres cerrar el socket cuando se cierre la pestaña
    //window.addEventListener('beforeunload', () => {
    //    if (socket.readyState === WebSocket.OPEN) {
    //        socket.close();
    //    }
    //});
});
