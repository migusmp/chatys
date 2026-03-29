import { useParams } from "react-router-dom";
import useIsMobile from "../../../../../hooks/useIsMobile";
import DmRoomMobile from "./DmRoomMobile";
import DmRoomDesktop from "./DmRoomDesktop";
import useFetch from "../../../../../hooks/useFetch";
import { useEffect, useState } from "react";
import type { FullConversation } from "../../../../../types/user";
import styles from "../../css/DmRoom.module.css";

export default function DmRoom() {
    const { username } = useParams();
    const isMobile = useIsMobile();
    const { fetchFullConversationInfo } = useFetch();

    const [conversationData, setConversationData] = useState<FullConversation | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetch = async () => {
            const data = await fetchFullConversationInfo(username ?? "", 25, 0, {
                signal: controller.signal,
            });
            if (data) {
                setConversationData(data);
            } else {
                console.error("No se pudo cargar la conversación");
            }
        };
        fetch();

        return () => {
            controller.abort();
        };
    }, [username]);

    if (!conversationData) {
        return (
            <div className={styles.loaderContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    return (
        <>
            {isMobile ? (
                <DmRoomMobile key={conversationData.conversation.id} conversationData={conversationData} />
            ) : (
                <DmRoomDesktop key={conversationData.conversation.id} conversationData={conversationData} />
            )}
        </>
    );
}
