// src/utils/roomSocket.ts
// WebSocket management for global chat rooms (/api/chat/join/{roomId})
// Mirrors the pattern from socket.ts (DM sockets) but keyed by room name (string).

type RoomMessageHandler<T = unknown> = (msg: T) => void;

const sockets = new Map<string, WebSocket>();
const listeners = new Map<string, EventListener>();
const reconnectIntervals = new Map<string, ReturnType<typeof setInterval>>();
const openCallbacks = new Map<string, (() => void)[]>();
const closeCallbacks = new Map<string, (() => void)[]>();

const protocol = location.protocol === "https:" ? "wss" : "ws";

/**
 * Connects to a chat room's WebSocket at /api/chat/join/{roomId}.
 * Stores the socket keyed by roomId so subsequent calls with the same
 * roomId reuse the existing open connection.
 */
export function connectToRoom<T = unknown>(
    roomId: string,
    onMessage: RoomMessageHandler<T>,
    onOpen?: () => void,
    onClose?: () => void,
): WebSocket {
    // Register optional lifecycle callbacks
    if (onOpen) {
        const existing = openCallbacks.get(roomId) ?? [];
        openCallbacks.set(roomId, [...existing, onOpen]);
    }
    if (onClose) {
        const existing = closeCallbacks.get(roomId) ?? [];
        closeCallbacks.set(roomId, [...existing, onClose]);
    }

    const existingSocket = sockets.get(roomId);

    const createSocket = (): WebSocket => {
        const ws = new WebSocket(
            `${protocol}://${location.host}/api/chat/join/${encodeURIComponent(roomId)}`
        );

        ws.addEventListener("open", () => {
            console.log(`[RoomWS] Conectado a sala "${roomId}"`);
            if (reconnectIntervals.has(roomId)) {
                clearInterval(reconnectIntervals.get(roomId)!);
                reconnectIntervals.delete(roomId);
            }
            openCallbacks.get(roomId)?.forEach((cb) => cb());
        });

        ws.addEventListener("error", (err) => {
            console.error(`[RoomWS] Error en sala "${roomId}"`, err);
        });

        ws.addEventListener("close", () => {
            console.warn(`[RoomWS] Socket cerrado para "${roomId}", reintentando en 5s...`);
            closeCallbacks.get(roomId)?.forEach((cb) => cb());
            attemptReconnect();
        });

        return ws;
    };

    const attemptReconnect = () => {
        if (reconnectIntervals.has(roomId)) return;

        const intervalId = setInterval(() => {
            console.log(`[RoomWS] Reintentando conexión a sala "${roomId}"...`);
            const newSocket = createSocket();
            sockets.set(roomId, newSocket);

            const prevListener = listeners.get(roomId);
            if (prevListener) {
                newSocket.addEventListener("message", prevListener);
            }

            if (newSocket.readyState === WebSocket.OPEN) {
                clearInterval(intervalId);
                reconnectIntervals.delete(roomId);
            }
        }, 5000);

        reconnectIntervals.set(roomId, intervalId);
    };

    let socket: WebSocket;

    if (!existingSocket || existingSocket.readyState !== WebSocket.OPEN) {
        socket = createSocket();
        sockets.set(roomId, socket);
    } else {
        console.log(`[RoomWS] Ya conectado a sala "${roomId}"`);
        socket = existingSocket;
    }

    // Replace previous message listener — only one active listener per room
    const prevListener = listeners.get(roomId);
    if (prevListener) {
        socket.removeEventListener("message", prevListener);
    }

    const listener: EventListener = (event) => {
        try {
            const parsed = JSON.parse((event as MessageEvent).data);
            onMessage(parsed as T);
        } catch (err) {
            console.error(`[RoomWS] Error al parsear mensaje en sala "${roomId}":`, err);
        }
    };

    socket.addEventListener("message", listener);
    listeners.set(roomId, listener);

    return socket;
}

/**
 * Sends a structured action to the room server as JSON.
 * The backend now expects JSON with an "action" discriminator field
 * instead of raw text.
 */
export function sendRoomAction(roomId: string, action: Record<string, unknown>): void {
    const socket = sockets.get(roomId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn(`[RoomWS] No se puede enviar: socket de sala "${roomId}" no está abierto`);
        return;
    }
    socket.send(JSON.stringify(action));
}

/**
 * Sends a chat message to the room.
 * Wrapper around sendRoomAction for the "message" action.
 */
export function sendRoomMessage(roomId: string, content: string): void {
    sendRoomAction(roomId, { action: "message", content });
}

/**
 * Sends a read acknowledgement for a specific message.
 */
export function sendRoomMarkRead(roomId: string, messageId: number): void {
    sendRoomAction(roomId, { action: "mark_read", message_id: messageId });
}

/**
 * Disconnects from a room and cleans up all associated state.
 */
export function disconnectFromRoom(roomId: string): void {
    const socket = sockets.get(roomId);
    const listener = listeners.get(roomId);

    if (socket) {
        if (listener) {
            socket.removeEventListener("message", listener);
            listeners.delete(roomId);
        }
        socket.close();
        sockets.delete(roomId);
    }

    if (reconnectIntervals.has(roomId)) {
        clearInterval(reconnectIntervals.get(roomId)!);
        reconnectIntervals.delete(roomId);
    }

    openCallbacks.delete(roomId);
    closeCallbacks.delete(roomId);

    console.log(`[RoomWS] Desconectado de sala "${roomId}"`);
}

/**
 * Returns the cached WebSocket for a room, or undefined if not connected.
 */
export function getRoomSocket(roomId: string): WebSocket | undefined {
    return sockets.get(roomId);
}
