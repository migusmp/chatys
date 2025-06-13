import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import '../../styles/layouts/Main.css';
import HeaderMobile from "./HeaderMobile";
import useIsMobile from "../../hooks/useIsMobile";
import { useEffect } from "react";

export default function Layout() {
    const isMobile = useIsMobile();
    
    useEffect(() => {
        if (isMobile) {
            document.body.classList.add("is-mobile");
        } else {
            document.body.classList.remove("is-mobile");
        }
    }, [isMobile]);
    return (
        <>
            {isMobile && <HeaderMobile />}
            <div style={{ display: 'flex', height: '100vh' }}>
                <Sidebar />
                <main>
                    <Outlet />
                </main>
            </div>
        </>
    )
}