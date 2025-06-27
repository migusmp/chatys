import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useUserContext } from './UserContext';

const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

    const socketRef = useRef<WebSocket | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const { setNotifications } = useUserContext();

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

                if (data?.type_msg === 'FR' || data?.type_msg === 'chat_message') {
                    setNotifications(prev => [data, ...prev]);
                    console.log('🔔 Nueva notificación:', data);
                }
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

