import { useParams } from "react-router-dom";
import useIsMobile from "../../../../../hooks/useIsMobile";

import DmRoomMobile from "./DmRoomMobile";
import DmRoomDesktop from "./DmRoomDesktop";
import useFetch from "../../../../../hooks/useFetch";
import { useEffect, useState } from "react";
import type { FullConversation } from "../../../../../types/user";

export default function DmRoom() {
    const { username } = useParams();
    const isMobile = useIsMobile();
    const { fetchFullConversationInfo } = useFetch();

    const [conversationData, setConversationData] = useState<FullConversation | null>(null);

    useEffect(() => {
        const fetch = async () => {
            const data = await fetchFullConversationInfo(username ?? "");
            if (data) {
                setConversationData(data);
            } else {
                console.error("No se pudo cargar la conversación");
            }
        };
        fetch();
    }, [username]);

    if (!conversationData) {
        return <div style={{ color: "white" }}>Cargando conversación...</div>;
    }

    return (
        <>
            {isMobile ? (
                <DmRoomMobile conversationData={conversationData} />
            ) : (
                <DmRoomDesktop conversationData={conversationData} />
            )}
        </>

    );
}