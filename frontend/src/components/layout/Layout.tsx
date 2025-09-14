import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import '../../styles/layouts/Main.css';
import HeaderMobile from "./HeaderMobile";
import useIsMobile from "../../hooks/useIsMobile";
import { useEffect } from "react";
import LastLocationTracker from "../LastLocationTracker";

export default function Layout() {
    const isMobile = useIsMobile();
    const location = useLocation();

    const isHeaderMobileRoute = () => {
        const path = location.pathname;

        // Excluir si empieza por /dm/ pero no si es exactamente /dm
        if (path.startsWith("/dm/")) return false;

        // Excluir también /profile y /settings completamente
        const excludedPaths = ["/profile", "/settings"];
        return !excludedPaths.some(p => path.startsWith(p));
    };

    const shouldShowHeaderMobile = isMobile && isHeaderMobileRoute();

    useEffect(() => {
        document.body.classList.remove("is-mobile", "mobile-with-header");

        if (isMobile) {
            document.body.classList.add("is-mobile");
            if (isHeaderMobileRoute()) {
                document.body.classList.add("mobile-with-header");
            }
        }
    }, [isMobile, location.pathname]);

    return (
        <>
            {shouldShowHeaderMobile && <HeaderMobile />}
            <div style={{ display: 'flex', height: '100vh' }}>
                <Sidebar />
                <main>
                    <LastLocationTracker />
                    <Outlet />
                </main>
            </div>
        </>
    )
}
