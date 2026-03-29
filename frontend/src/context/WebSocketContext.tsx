import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useFriendsContext, useNotificationsContext } from "./UserContext";
import type { NewDmMessageNotification } from "../interfaces/notifications";

const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const retryCountRef = useRef(0);
    const shouldReconnectRef = useRef(true);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const { setActiveFriends } = useFriendsContext();
    const { setNotifications, setNewLastMessage, setDmNotifications } =
        useNotificationsContext();

    useEffect(() => {
        const clearReconnectTimeout = () => {
            if (reconnectTimeoutRef.current !== null) {
                window.clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        const scheduleReconnect = () => {
            if (!shouldReconnectRef.current) {
                return;
            }

            clearReconnectTimeout();
            const retryCount = retryCountRef.current;
            const delay = Math.min(1000 * 2 ** retryCount, 30000);

            reconnectTimeoutRef.current = window.setTimeout(() => {
                retryCountRef.current += 1;
                connectWebSocket();
            }, delay);
        };

        const connectWebSocket = () => {
            const socket = new WebSocket(`${protocol}://${location.host}/ws`);
            socketRef.current = socket;
            setWs(socket);

            socket.onopen = () => {
                retryCountRef.current = 0;
                clearReconnectTimeout();
                console.log("✅ WebSocket conectado");
            };

            socket.onclose = () => {
                console.log("🔌 WebSocket cerrado");
                scheduleReconnect();
            };

            socket.onerror = (err) => {
                console.error("❌ WebSocket error", err);
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close();
                }
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("DATA DESDE WEB SOCKET:", data);

                    if (data?.type_msg === "chat_message" || data?.type_msg === "NEW_DM_MESSAGE") {
                        const path = window.location.pathname;
                        const pathParts = path.split("/");
                        const route = pathParts[1];
                        const username = pathParts[2];

                        const convId = Number(data.conversation_id);

                        setNewLastMessage((prev) => {
                            const arr = Array.isArray(prev) ? prev : [];
                            const filtered = arr.filter(
                                (n) => Number(n.conversation_id) !== convId
                            );
                            return [data as NewDmMessageNotification, ...filtered];
                        });

                        const isOnDmRoute = route === "dm";
                        const isCurrentOpenChat =
                            isOnDmRoute &&
                            ((data.type_msg === "NEW_DM_MESSAGE" && username === data.from_user_username) ||
                                (data.type_msg === "chat_message" && username === data.sender_username));

                        if (!isCurrentOpenChat) {
                            setDmNotifications((prev) => [data, ...prev]);
                        }

                        return;
                    }

                    if (data?.type_msg === "FR") {
                        setNotifications((prev) => [data, ...prev]);
                        return;
                    }

                    if (data?.type_msg === "active_friends") {
                        setActiveFriends(data.friends);
                        return;
                    }
                } catch (_e) {
                    console.warn("⚠️ Mensaje no JSON:", event.data);
                }
            };
        };

        shouldReconnectRef.current = true;
        connectWebSocket();

        return () => {
            shouldReconnectRef.current = false;
            clearReconnectTimeout();
            const socket = socketRef.current;
            socketRef.current = null;
            setWs(null);
            if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.close();
            }
        };
    }, [protocol, setActiveFriends, setDmNotifications, setNewLastMessage, setNotifications]);

    return (
        <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);
