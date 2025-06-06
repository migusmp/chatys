const sockets = new Map();      // friendId -> WebSocket
const listeners = new Map();    // friendId -> function
const reconnectIntervals = new Map(); // friendId -> intervalId

const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

export function connectToFriend(friendId, onMessage) {
    let socket = sockets.get(friendId);

    function createSocket() {
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${friendId}`);

        ws.addEventListener('open', () => {
            console.log(`Conectado al socket del amigo ${friendId}`);

            // Si estamos reconectando, parar el intervalo
            if (reconnectIntervals.has(friendId)) {
                clearInterval(reconnectIntervals.get(friendId));
                reconnectIntervals.delete(friendId);
            }
        });

        ws.addEventListener('error', (err) => {
            console.error(`WebSocket error con ${friendId}`, err);
            // El error puede cerrar el socket, no hacemos nada extra aquí
        });

        ws.addEventListener('close', () => {
            console.log(`Socket cerrado para ${friendId}, intentando reconectar...`);
            attemptReconnect();
        });

        return ws;
    }

    function attemptReconnect() {
        if (reconnectIntervals.has(friendId)) return; // Ya reconectando

        const intervalId = setInterval(() => {
            console.log(`Intentando reconectar socket para ${friendId}...`);
            const newSocket = createSocket();
            sockets.set(friendId, newSocket);

            // Asociar listener a nuevo socket
            const prevListener = listeners.get(friendId);
            if (prevListener) {
                newSocket.addEventListener('message', prevListener);
            }

            if (newSocket.readyState === WebSocket.OPEN) {
                clearInterval(intervalId);
                reconnectIntervals.delete(friendId);
            }
        }, 5000);

        reconnectIntervals.set(friendId, intervalId);
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        socket = createSocket();
        sockets.set(friendId, socket);
    } else {
        console.log(`Socket ya conectado para ${friendId}`);
    }

    // Evitar duplicar listeners
    const previousListener = listeners.get(friendId);
    if (previousListener && socket) {
        socket.removeEventListener('message', previousListener);
    }

    const messageHandler = (event) => {
        try {
            const msg = JSON.parse(event.data);
            onMessage(msg);
        } catch (err) {
            console.error("Error al parsear mensaje:", err);
        }
    };

    if (socket) {
        socket.addEventListener('message', messageHandler);
        listeners.set(friendId, messageHandler);
    }
}

export function getSocketDm(friendId) {
    return sockets.get(friendId);
}

export function disconnectFromFriend(friendId) {
    const socket = sockets.get(friendId);
    const listener = listeners.get(friendId);

    if (socket) {
        if (listener) {
            socket.removeEventListener('message', listener);
            listeners.delete(friendId);
        }

        socket.close();
        sockets.delete(friendId);
    }

    if (reconnectIntervals.has(friendId)) {
        clearInterval(reconnectIntervals.get(friendId));
        reconnectIntervals.delete(friendId);
    }
}
