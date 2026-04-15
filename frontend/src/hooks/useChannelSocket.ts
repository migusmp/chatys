import { useEffect, useRef, useState } from "react";
import {
    connectToChannel,
    disconnectFromChannel,
    sendChannelMessage,
} from "../utils/channelSocket";

export interface ChannelMessage {
    id: number;
    channel_id: string;
    server_id: string;
    conversation_id: number;
    sender_id: number;
    username: string;
    image?: string;
    content: string;
    created_at: string;
    type_msg: string;
}

export function useChannelSocket(
    serverId: string | null,
    channelId: string | null,
    onMessage: (msg: ChannelMessage) => void,
): {
    sendMessage: (content: string) => void;
    connected: boolean;
} {
    const [connected, setConnected] = useState(false);

    // Stable ref so the message handler closure never goes stale on re-renders
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        if (!serverId || !channelId) {
            setConnected(false);
            return;
        }

        const handleMessage = (raw: ChannelMessage) => {
            if (raw.type_msg === "chat_message") {
                onMessageRef.current(raw);
            }
        };

        connectToChannel<ChannelMessage>(
            serverId,
            channelId,
            handleMessage,
            () => setConnected(true),
            () => setConnected(false),
        );

        return () => {
            disconnectFromChannel(serverId, channelId);
            setConnected(false);
        };
    }, [serverId, channelId]);

    const sendMessage = (content: string) => {
        if (!serverId || !channelId) return;
        const trimmed = content.trim();
        if (!trimmed) return;
        sendChannelMessage(serverId, channelId, trimmed);
    };

    return { sendMessage, connected };
}
