import { useEffect, useState } from "react";
import type { Conversations } from "../../../../types/user";
import useFetch from "../../../../hooks/useFetch";
import { useNotificationsContext } from "../../../../context/UserContext";
import SidebarDmsMobile from "./SidebarDms/SidebarDmsMobile";
import useIsMobile from "../../../../hooks/useIsMobile";
import { mergeDmsWithRealtimeMessages } from "./SidebarDms/realtimeDmList";

export default function DmList() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();
    const isMobile = useIsMobile();
    const { newLastMessage } = useNotificationsContext();

    useEffect(() => {
        if (!isMobile) return;
        const fetch = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };
        fetch();
    }, []);

    useEffect(() => {
        if (!isMobile) return;
        if (newLastMessage.length === 0) {
            return;
        }

        setDms((currentDms) => mergeDmsWithRealtimeMessages(currentDms, newLastMessage));
    }, [newLastMessage, isMobile]);

    if (!isMobile) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                backgroundColor: "#000",
                color: "#fff",
                gap: "12px",
                userSelect: "none",
            }}>
                <div style={{ fontSize: "64px", opacity: 1, color: "#00ff66" }}>💬</div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600, opacity: 0.7 }}>
                    Tus mensajes
                </h2>
                <p style={{ margin: 0, fontSize: "14px", opacity: 0.4, textAlign: "center" }}>
                    Seleccioná una conversación o buscá un usuario para empezar a chatear.
                </p>
            </div>
        );
    }

    return <SidebarDmsMobile dms={dms} />;
}
