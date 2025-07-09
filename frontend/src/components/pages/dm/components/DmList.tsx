import { useEffect, useState } from "react";
import type { Conversations } from "../../../../types/user";
import useFetch from "../../../../hooks/useFetch";
import SidebarDmsMobile from "./SidebarDms/SidebarDmsMobile";
import useIsMobile from "../../../../hooks/useIsMobile";
import { Navigate } from "react-router-dom";

export default function DmList() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();
    const isMobile = useIsMobile();

    useEffect(() => {
        const fetch = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };
        fetch();
    }, []);

    if (!isMobile) {
        return <Navigate to="/dm" replace />;
    }

    return <SidebarDmsMobile dms={dms} />;
}
