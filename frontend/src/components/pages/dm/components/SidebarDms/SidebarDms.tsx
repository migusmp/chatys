import { Outlet } from "react-router-dom";
import type { Conversations } from "../../../../../types/user";
import SidebarDesktop from "./SidebarDmsDesktop";
import SidebarMobile from "./SidebarDmsMobile";

type Props = {
    dms: Conversations[];
    isMobile: boolean;
    setDms: React.Dispatch<React.SetStateAction<Conversations[]>>;
};

export default function SidebarDms({ dms, isMobile, setDms }: Props) {
    if (isMobile) {
        return <SidebarMobile dms={dms} />;
    }

    // En desktop: sidebar + chat (Outlet)
    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <SidebarDesktop dms={dms} setDms={setDms}/>
            <div style={{ flex: 1, padding: "2rem", backgroundColor: "#111", color: "#fff" }}>
                <Outlet />
            </div>
        </div>
    );
}
