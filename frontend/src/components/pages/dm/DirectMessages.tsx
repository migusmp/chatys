import { useEffect, useState } from "react";
import type { Conversations } from "../../../types/user";
import useFetch from "../../../hooks/useFetch";
import useIsMobile from "../../../hooks/useIsMobile";import SidebarDms from "./components/SidebarDms";
;

export default function DirectMessages() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();
    const isMobile = useIsMobile();

    useEffect(() => {
        const fetchDms = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };

        fetchDms();
    }, []);

    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <SidebarDms dms={dms} isMobile={isMobile} />
            <div style={{ flex: 1, padding: "2rem", backgroundColor: "#111", color: "#fff" }}>
                <h1>Área de Chat</h1>
                {/* Aquí puedes renderizar el contenido del chat seleccionado */}
            </div>
        </div>
    );
}
