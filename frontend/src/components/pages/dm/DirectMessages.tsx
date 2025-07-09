import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import useIsMobile from "../../../hooks/useIsMobile";
import useFetch from "../../../hooks/useFetch";
import type { Conversations } from "../../../types/user";
import SidebarDesktop from "./components/SidebarDms/SidebarDmsDesktop";
import SidebarMobile from "./components/SidebarDms/SidebarDmsMobile";

export default function DirectMessages() {
    const isMobile = useIsMobile();
    const location = useLocation();
    const { fetchUserDms } = useFetch();

    const [dms, setDms] = useState<Conversations[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };
        fetch();
    }, []);

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
            <SidebarDesktop dms={dms} />
            <div style={{ flex: 1, backgroundColor: "#111", color: "#fff", overflowY: "auto" }}>
                <Outlet />
            </div>
        </div>
    );
}
