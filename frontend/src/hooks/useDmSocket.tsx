import { useEffect, useState } from "react";
import { connectToFriend, disconnectFromFriend, getSocketDm } from "../utils/socket";

export function useDmSocket<T = unknown>(friendId: number) {
  const [messages, setMessages] = useState<T[]>([]);

  useEffect(() => {
    if (!friendId) return;

    const handleMessage = (msg: T) => {
      setMessages(prev => [...prev, msg]);
    };

    connectToFriend<T>(friendId, handleMessage);

    return () => {
      disconnectFromFriend(friendId);
      setMessages([]); // limpia mensajes al desconectar
    };
  }, [friendId]);

  const sendMessage = (message: { content: string }) => {
    const socket = getSocketDm(friendId);
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(message));
  };

  return {
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
  };
}
