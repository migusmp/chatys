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

                if (
                    data?.type_msg === "chat_message" ||
                    data?.type_msg === "NEW_DM_MESSAGE"
                ) {
                    // Obtener la ruta actual
                    const path = window.location.pathname; // Ejemplo: "/dm/chrome"
                    const pathParts = path.split("/"); // ["", "dm"] o ["", "dm", "chrome"]
                    const route = pathParts[1];
                    const username = pathParts[2]; // undefined si no hay usuario en la ruta
                    console.log("username:", username);

                    // Si estoy en el chat de esa persona, ignorar
                    if (route === "dm" && data.type_msg === "NEW_DM_MESSAGE" && username === data.from_user_username) {
                        console.log("🔔 Nueva notificación de DM, pero estoy en el chat de esa persona, ignorar");
                        return;
                    }

                    const convId = Number(data.conversation_id);
                    console.log("🔔 GUARDANDO NEW LAST MESSAGE", data);
                    setNewLastMessage((prev) => {
                        const arr = Array.isArray(prev) ? prev : [];

                        // Filtramos cualquier entrada previa de la misma conversación
                        const filtered = arr.filter(
                            (n) => Number(n.conversation_id) !== convId
                        );

                        // Insertamos la nueva al principio
                        return [data as NewDmMessageNotification, ...filtered];
                    });

                    // Actualizamos el array de notificaciones
                    console.log("🔔 Nueva notificación de DM:", data);
                    setDmNotifications((prev) => [data, ...prev]);

                    console.log("🔔 Nueva notificación de DM:", data);
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
