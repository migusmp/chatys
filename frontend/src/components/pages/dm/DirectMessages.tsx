import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import useIsMobile from "../../../hooks/useIsMobile";
import useFetch from "../../../hooks/useFetch";
import { useNotificationsContext } from "../../../context/UserContext";
import type { Conversations } from "../../../types/user";
import SidebarDesktop from "./components/SidebarDms/SidebarDmsDesktop";
import SidebarMobile from "./components/SidebarDms/SidebarDmsMobile";
import { mergeDmsWithRealtimeMessages } from "./components/SidebarDms/realtimeDmList";

export default function DirectMessages() {
    const isMobile = useIsMobile();
    const location = useLocation();
    const { fetchUserDms } = useFetch();
    const { newLastMessage } = useNotificationsContext();

    const [dms, setDms] = useState<Conversations[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };
        fetch();
    }, []);

    useEffect(() => {
        if (newLastMessage.length === 0) {
            return;
        }

        setDms((currentDms) => mergeDmsWithRealtimeMessages(currentDms, newLastMessage));
    }, [newLastMessage]);

    if (isMobile) {
        // Solo lista o solo chat en móvil, depende de la ruta
        return location.pathname === "/dm" ? (
            <SidebarMobile dms={dms} />
        ) : (
            <Outlet />
        );
    }

    // En desktop: sidebar fijo y área de chat
    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <SidebarDesktop dms={dms} setDms={setDms}/>
            <div style={{ flex: 1, backgroundColor: "#111", color: "#fff", overflowY: "auto" }}>
                <Outlet />
            </div>
        </div>
    );
}
