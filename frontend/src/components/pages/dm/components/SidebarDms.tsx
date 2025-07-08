import { useState } from "react";
import type { Conversations } from "../../../../types/user";

type SidebarProps = {
    dms: Conversations[];
    isMobile: boolean;
};

export default function SidebarDms({ dms, isMobile }: SidebarProps) {
    const [open, setOpen] = useState(false);

    const toggleMenu = () => setOpen(prev => !prev);

    return (
        <>
            {isMobile ? (
                <>
                    {/* Botón hamburguesa */}
                    <button
                        onClick={toggleMenu}
                        style={{
                            position: "absolute",
                            top: "1rem",
                            left: "1rem",
                            zIndex: 1000,
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "2rem",
                            cursor: "pointer",
                        }}
                    >
                        ☰
                    </button>

                    {/* Panel deslizable */}
                    {open && (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                height: "100vh",
                                width: "300px",
                                backgroundColor: "#1e1e2f",
                                padding: "1rem",
                                zIndex: 999,
                                overflowY: "auto",
                            }}
                        >
                            <h2 style={{ color: "#fff" }}>Chats</h2>
                            <ul>
                                {dms.map((dm) => (
                                    <li
                                        key={dm.conversation_id}
                                        style={{ color: "#fff", padding: "0.5rem 0" }}
                                        onClick={() => setOpen(false)} // opcional: cerrar al hacer clic
                                    >
                                        {dm.participants[0]?.username}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            ) : (
                // Sidebar fija para desktop
                <div
                    style={{
                        width: "300px",
                        backgroundColor: "#1e1e2f",
                        height: "100vh",
                        padding: "1rem",
                        overflowY: "auto",
                        borderRight: "1px solid #333",
                    }}
                >
                    <h2 style={{ color: "#fff" }}>Chats</h2>
                    <ul>
                        {dms.map((dm) => (
                            <li
                                key={dm.conversation_id}
                                style={{ color: "#fff", padding: "0.5rem 0" }}
                            >
                                {dm.participants[0]?.username}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}
