import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function LastLocationTracker() {
    const location = useLocation();

    useEffect(() => {
        if (!location.pathname.startsWith("/settings")) {
            sessionStorage.setItem("lastNonSettingsURL", location.pathname);
        }
    }, [location.pathname]);

    return null;
}