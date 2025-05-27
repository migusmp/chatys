document.addEventListener('DOMContentLoaded', () => {
    const socket = new WebSocket(`ws://${location.host}/ws`);

    socket.onopen = () => {
        console.log('Conexión WebSocket establecida');
        // Por ejemplo, enviar un mensaje al servidor al conectarte:
        // socket.send(JSON.stringify({ type: 'hello', payload: 'Hola servidor' }));
    };

    socket.onmessage = (event) => {
        console.log('Mensaje recibido del servidor:', event.data);
        // Aquí puedes actualizar la UI con la info recibida
    };

    socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
    };

    // Si quieres cerrar el socket cuando se cierre la pestaña
    //window.addEventListener('beforeunload', () => {
    //    if (socket.readyState === WebSocket.OPEN) {
    //        socket.close();
    //    }
    //});
});
  