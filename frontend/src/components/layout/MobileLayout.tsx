// src/layouts/MobileLayout.tsx
import { Outlet } from "react-router-dom";
import HeaderMobile from "./HeaderMobile";
import SidebarMovile from "./SidebarMovile";
import { useEffect } from "react";

export default function MobileLayout() {
    useEffect(() => {
        document.body.classList.add("is-mobile");
        return () => document.body.classList.remove("is-mobile");
    }, []);
    return (
        <>
            <HeaderMobile />
            <div style={{ display: "flex", height: "100vh" }}>
                <SidebarMovile />
                <main>
                    <Outlet />
                </main>
            </div>
        </>
    );
}