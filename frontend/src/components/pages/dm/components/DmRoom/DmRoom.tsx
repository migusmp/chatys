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
            const data = await fetchFullConversationInfo(username ?? "", 25, 0);
            if (data) {
                setConversationData(data);
            } else {
                console.error("No se pudo cargar la conversación");
            }
        };
        fetch();
    }, [username]);

    if (!conversationData) {
        return (
            <div style={styles.loaderContainer}>
                <div style={styles.spinner}></div>
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

const styles: { [key: string]: React.CSSProperties } = {
    loaderContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100vh",
        backgroundColor: "#000", // Fondo negro que ocupa todo
    },
    spinner: {
        width: "48px",
        height: "48px",
        border: "4px solid #0f6", // verde
        borderTop: "4px solid #000", // negro, crea efecto de rotación
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    },
};

// Animación global del spinner
const styleSheet = document.createElement("style");
styleSheet.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(styleSheet);

