import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useUserContext } from "./UserContext";
import type { NewDmMessageNotification } from "../interfaces/notifications";

const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";

    const socketRef = useRef<WebSocket | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const { setNotifications, setActiveFriends, setNewLastMessage, setDmNotifications } =
        useUserContext();

    useEffect(() => {
        const socket = new WebSocket(`${protocol}://${location.host}/ws`);
        socketRef.current = socket;
        setWs(socket);

        socket.onopen = () => console.log("✅ WebSocket conectado");
        socket.onclose = () => console.log("🔌 WebSocket cerrado");
        socket.onerror = (err) => console.error("❌ WebSocket error", err);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("DATA DESDE WEB SOCKET:", data);

                if (data?.type_msg === "chat_message" || data?.type_msg === "NEW_DM_MESSAGE") {
                    const path = window.location.pathname; // "/dm/chrome"
                    const pathParts = path.split("/"); // ["", "dm", "chrome"]
                    const route = pathParts[1];
                    const username = pathParts[2];

                    const convId = Number(data.conversation_id);

                    // ✅ Siempre actualizamos el último mensaje para la sidebar
                    console.log("🔔 GUARDANDO NEW LAST MESSAGE", data);
                    setNewLastMessage((prev) => {
                        const arr = Array.isArray(prev) ? prev : [];
                        const filtered = arr.filter(
                            (n) => Number(n.conversation_id) !== convId
                        );
                        return [data as NewDmMessageNotification, ...filtered];
                    });

                    // ✅ Solo guardamos como notificación si NO estoy dentro del chat abierto
                    console.log("Estoy en la ruta?,"!,(route === "dm" && username === data.from_user_username));
                    if (!(route === "dm" && data.type_msg === "NEW_DM_MESSAGE" && username === data.from_user_username || data.type_msg === "chat_message" && username === data.sender_username)) {
                        console.log("🔔 Nueva notificación de DM:", data);
                        setDmNotifications((prev) => [data, ...prev]);
                    }

                    return;
                }
                if (
                    data?.type_msg === "FR"
                ) {
                    setNotifications((prev) => [data, ...prev]);

                    console.log("🔔 Nueva notificación:", data);
                    return;
                }

                if (data?.type_msg === "active_friends") {
                    setActiveFriends(data.friends);
                    console.log("👥 Amigos activos actualizados:", data.friends);
                    return;
                }
                console.log("OTRO MENSAJE:", data);
            } catch (e) {
                console.warn("⚠️ Mensaje no JSON:", event.data);
            }
        };

        return () => {
            socket.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);
