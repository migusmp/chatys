// src/layouts/DesktopLayout.tsx
import { Outlet } from "react-router-dom";
import SidebarDesktop from "./SidebarDesktop";

export default function DesktopLayout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <SidebarDesktop />
      <main>
        <Outlet />
      </main>
    </div>
  );
}