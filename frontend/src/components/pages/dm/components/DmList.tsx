import { useEffect, useState } from "react";
import type { Conversations } from "../../../../types/user";
import useFetch from "../../../../hooks/useFetch";
import { useNotificationsContext } from "../../../../context/UserContext";
import SidebarDmsMobile from "./SidebarDms/SidebarDmsMobile";
import useIsMobile from "../../../../hooks/useIsMobile";
import { Navigate } from "react-router-dom";
import { mergeDmsWithRealtimeMessages } from "./SidebarDms/realtimeDmList";

export default function DmList() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();
    const isMobile = useIsMobile();
    const { newLastMessage } = useNotificationsContext();

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

    if (!isMobile) {
        return <Navigate to="/dm" replace />;
    }

    return <SidebarDmsMobile dms={dms} />;
}
