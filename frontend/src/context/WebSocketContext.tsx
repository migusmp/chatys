import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useUserContext } from './UserContext';
import type { NewDmMessageNotification } from '../interfaces/notifications';

const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

    const socketRef = useRef<WebSocket | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const { setNotifications, setActiveFriends, setNewLastMessage } = useUserContext();

    useEffect(() => {
        const socket = new WebSocket(`${protocol}://${location.host}/ws`);
        socketRef.current = socket;
        setWs(socket);

        socket.onopen = () => console.log('✅ WebSocket conectado');
        socket.onclose = () => console.log('🔌 WebSocket cerrado');
        socket.onerror = (err) => console.error('❌ WebSocket error', err);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data?.type_msg === 'FR' || data?.type_msg === 'chat_message' || data?.type_msg === 'NEW_DM_MESSAGE') {
                    if (data.type_msg === 'NEW_DM_MESSAGE') {

                        // Obtener la ruta actual
                        const path = window.location.pathname; // Ejemplo: "/dm/chrome"
                        const [, route, username] = path.split("/"); // ["", "dm", "chrome"]

                        // Si estoy en el chat de esa persona, ignorar
                        if (route === "dm" && username === data.from_user_username) {
                            return;
                        }

                        const convId = Number(data.conversation_id);

                        setNewLastMessage(prev => {
                            const arr = Array.isArray(prev) ? prev : [];

                            // Filtramos cualquier entrada previa de la misma conversación
                            const filtered = arr.filter(n => Number(n.conversation_id) !== convId);

                            // Insertamos la nueva al principio
                            return [data as NewDmMessageNotification, ...filtered];
                        });

                    }

                    setNotifications(prev => [data, ...prev]);

                    console.log('🔔 Nueva notificación:', data);
                    return;
                }

                if (data?.type_msg === 'active_friends') {
                    setActiveFriends(data.friends);
                    console.log('👥 Amigos activos actualizados:', data.friends);
                    return;
                }
                console.log("OTRO MENSAJE:", data);

            } catch (e) {
                console.warn('⚠️ Mensaje no JSON:', event.data);
            }
        };

        return () => {
            socket.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={ws}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);

