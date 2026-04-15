// src/utils/channelSocket.ts
// WebSocket management for server channel messaging (/ws/server/{serverId}/channel/{channelId}).
// Mirrors roomSocket.ts but keyed by a composite "serverId:channelId" string.

type ChannelMessageHandler<T = unknown> = (msg: T) => void;

const sockets = new Map<string, WebSocket>();
const listeners = new Map<string, EventListener>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const openCallbacks = new Map<string, (() => void)[]>();
const closeCallbacks = new Map<string, (() => void)[]>();

const protocol = location.protocol === "https:" ? "wss" : "ws";

function channelKey(serverId: string, channelId: string): string {
    return `${serverId}:${channelId}`;
}

/**
 * Connects to a channel's WebSocket at /ws/server/{serverId}/channel/{channelId}.
 * Reuses an existing open connection if already established for the same channel.
 */
export function connectToChannel<T = unknown>(
    serverId: string,
    channelId: string,
    onMessage: ChannelMessageHandler<T>,
    onOpen?: () => void,
    onClose?: () => void,
): WebSocket {
    const key = channelKey(serverId, channelId);

    if (onOpen) {
        const existing = openCallbacks.get(key) ?? [];
        openCallbacks.set(key, [...existing, onOpen]);
    }
    if (onClose) {
        const existing = closeCallbacks.get(key) ?? [];
        closeCallbacks.set(key, [...existing, onClose]);
    }

    const existingSocket = sockets.get(key);

    const createSocket = (): WebSocket => {
        const ws = new WebSocket(
            `${protocol}://${location.host}/ws/server/${encodeURIComponent(serverId)}/channel/${encodeURIComponent(channelId)}`
        );

        ws.addEventListener("open", () => {
            console.log(`[ChannelWS] Conectado al canal "${channelId}" del servidor "${serverId}"`);
            if (reconnectTimers.has(key)) {
                clearTimeout(reconnectTimers.get(key)!);
                reconnectTimers.delete(key);
            }
            openCallbacks.get(key)?.forEach((cb) => cb());
        });

        ws.addEventListener("error", (err) => {
            console.error(`[ChannelWS] Error en canal "${channelId}" (servidor "${serverId}")`, err);
        });

        ws.addEventListener("close", () => {
            console.warn(
                `[ChannelWS] Socket cerrado para canal "${channelId}" (servidor "${serverId}"), reintentando en 3s...`
            );
            closeCallbacks.get(key)?.forEach((cb) => cb());
            scheduleReconnect();
        });

        return ws;
    };

    const scheduleReconnect = () => {
        if (reconnectTimers.has(key)) return;

        const timerId = setTimeout(() => {
            reconnectTimers.delete(key);
            console.log(`[ChannelWS] Reintentando conexión al canal "${channelId}"...`);
            const newSocket = createSocket();
            sockets.set(key, newSocket);

            const prevListener = listeners.get(key);
            if (prevListener) {
                newSocket.addEventListener("message", prevListener);
            }
        }, 3000);

        reconnectTimers.set(key, timerId);
    };

    let socket: WebSocket;

    if (!existingSocket || existingSocket.readyState !== WebSocket.OPEN) {
        socket = createSocket();
        sockets.set(key, socket);
    } else {
        console.log(`[ChannelWS] Ya conectado al canal "${channelId}"`);
        socket = existingSocket;
    }

    // Replace previous message listener — only one active listener per channel
    const prevListener = listeners.get(key);
    if (prevListener) {
        socket.removeEventListener("message", prevListener);
    }

    const listener: EventListener = (event) => {
        try {
            const parsed = JSON.parse((event as MessageEvent).data);
            onMessage(parsed as T);
        } catch (err) {
            console.error(`[ChannelWS] Error al parsear mensaje en canal "${channelId}":`, err);
        }
    };

    socket.addEventListener("message", listener);
    listeners.set(key, listener);

    return socket;
}

/**
 * Sends a message to a channel.
 */
export function sendChannelMessage(serverId: string, channelId: string, content: string): void {
    const key = channelKey(serverId, channelId);
    const socket = sockets.get(key);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn(`[ChannelWS] No se puede enviar: socket del canal "${channelId}" no está abierto`);
        return;
    }
    socket.send(JSON.stringify({ action: "message", content }));
}

/**
 * Disconnects from a channel and cleans up all associated state.
 */
export function disconnectFromChannel(serverId: string, channelId: string): void {
    const key = channelKey(serverId, channelId);
    const socket = sockets.get(key);
    const listener = listeners.get(key);

    if (socket) {
        if (listener) {
            socket.removeEventListener("message", listener);
            listeners.delete(key);
        }
        socket.close();
        sockets.delete(key);
    }

    if (reconnectTimers.has(key)) {
        clearTimeout(reconnectTimers.get(key)!);
        reconnectTimers.delete(key);
    }

    openCallbacks.delete(key);
    closeCallbacks.delete(key);

    console.log(`[ChannelWS] Desconectado del canal "${channelId}" (servidor "${serverId}")`);
}

/**
 * Returns the cached WebSocket for a channel, or undefined if not connected.
 */
export function getChannelSocket(serverId: string, channelId: string): WebSocket | undefined {
    return sockets.get(channelKey(serverId, channelId));
}
