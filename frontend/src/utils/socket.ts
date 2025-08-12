// src/lib/socket.ts

type MessageHandler<T = unknown> = (msg: T) => void;

const sockets = new Map<number, WebSocket>();
const listeners = new Map<number, EventListener>();
const reconnectIntervals = new Map<number, ReturnType<typeof setInterval>>();

const protocol = location.protocol === "https:" ? "wss" : "ws";

/**
 * Conecta al WebSocket de un amigo por ID
 */
export function connectToFriend<T = unknown>(
    friendId: number,
    onMessage: MessageHandler<T>
): WebSocket {
    let socket = sockets.get(friendId);

    const createSocket = (): WebSocket => {
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${friendId}`);

        ws.addEventListener("open", () => {
            console.log(`[WS] Conectado a /ws/${friendId}`);
            if (reconnectIntervals.has(friendId)) {
                clearInterval(reconnectIntervals.get(friendId)!);
                reconnectIntervals.delete(friendId);
            }
        });

        ws.addEventListener("error", (err) => {
            console.error(`[WS] Error con /ws/${friendId}`, err);
        });

        ws.addEventListener("close", () => {
            console.warn(`[WS] Socket cerrado para ${friendId}, reintentando...`);
            attemptReconnect();
        });

        return ws;
    };

    const attemptReconnect = () => {
        if (reconnectIntervals.has(friendId)) return;

        const intervalId = setInterval(() => {
            console.log(`[WS] Reintentando conexión para ${friendId}...`);
            const newSocket = createSocket();
            sockets.set(friendId, newSocket);

            const prevListener = listeners.get(friendId);
            if (prevListener) {
                newSocket.addEventListener("message", prevListener);
            }

            if (newSocket.readyState === WebSocket.OPEN) {
                clearInterval(intervalId);
                reconnectIntervals.delete(friendId);
            }
        }, 5000);

        reconnectIntervals.set(friendId, intervalId);
    };

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        socket = createSocket();
        sockets.set(friendId, socket);
    } else {
        console.log(`[WS] Ya conectado a /ws/${friendId}`);
    }

    // Limpiar listener anterior si hay
    const prevListener = listeners.get(friendId);
    if (prevListener && socket) {
        socket.removeEventListener("message", prevListener);
    }

    const listener: EventListener = (event) => {
        try {
            const parsed = JSON.parse((event as MessageEvent).data);
            onMessage(parsed as T);
        } catch (err) {
            console.error("Error al parsear mensaje:", err);
        }
    };

    socket.addEventListener("message", listener);
    listeners.set(friendId, listener);

    return socket;
}


/**
 * Obtiene el WebSocket activo para un amigo
 */
export function getSocketDm(friendId: number): WebSocket | undefined {
    return sockets.get(friendId);
}

/**
 * Desconecta del socket de un amigo y limpia listeners
 */
export function disconnectFromFriend(friendId: number): void {
    const socket = sockets.get(friendId);
    const listener = listeners.get(friendId);

    if (socket) {
        if (listener) {
            socket.removeEventListener("message", listener);
            listeners.delete(friendId);
        }

        socket.close();
        sockets.delete(friendId);
    }

    if (reconnectIntervals.has(friendId)) {
        clearInterval(reconnectIntervals.get(friendId)!);
        reconnectIntervals.delete(friendId);
    }

    console.log(`[WS] Desconectado de /ws/${friendId}`);
}
