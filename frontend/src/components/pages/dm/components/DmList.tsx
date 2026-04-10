import { useEffect, useState } from "react";
import type { Conversations } from "../../../../types/user";
import useFetch from "../../../../hooks/useFetch";
import { useNotificationsContext } from "../../../../context/UserContext";
import SidebarDmsMobile from "./SidebarDms/SidebarDmsMobile";
import useIsMobile from "../../../../hooks/useIsMobile";
import { mergeDmsWithRealtimeMessages } from "./SidebarDms/realtimeDmList";
import styles from "../css/DmList.module.css";

const FEATURE_CARDS = [
    { icon: "💬", label: "Mensajes directos" },
    { icon: "👥", label: "Chats grupales" },
    { icon: "🔍", label: "Buscar usuarios" },
];

export default function DmList() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();
    const isMobile = useIsMobile();
    const { newLastMessage } = useNotificationsContext();

    useEffect(() => {
        if (!isMobile) return;
        const fetch = async () => {
            const data = await fetchUserDms();
            setDms(data ?? []);
        };
        fetch();
    }, []);

    useEffect(() => {
        if (!isMobile) return;
        if (newLastMessage.length === 0) {
            return;
        }

        setDms((currentDms) => mergeDmsWithRealtimeMessages(currentDms, newLastMessage));
    }, [newLastMessage, isMobile]);

    if (!isMobile) {
        return (
            <div className={styles.emptyState}>
                {/* Hero icon con anillo de pulso */}
                <div className={styles.heroArea}>
                    <div className={styles.pulseRing}></div>
                    <svg
                        className={styles.heroIcon}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                            stroke="#00ff66"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx="8.5" cy="11" r="1" fill="#00ff66" />
                        <circle cx="12" cy="11" r="1" fill="#00ff66" />
                        <circle cx="15.5" cy="11" r="1" fill="#00ff66" />
                    </svg>
                </div>

                {/* Título y subtítulo */}
                <div className={styles.textBlock}>
                    <h2 className={styles.title}>Tus conversaciones</h2>
                    <p className={styles.subtitle}>
                        Selecciona un chat o busca a alguien para empezar
                    </p>

                    {/* Word-cycling loader — mantenido del diseño original */}
                    <div className={styles.loader}>
                        <p>cargando</p>
                        <div className={styles.words}>
                            <span className={styles.word}>mensajes</span>
                            <span className={styles.word}>chats</span>
                            <span className={styles.word}>amigos</span>
                            <span className={styles.word}>archivos</span>
                            <span className={styles.word}>mensajes</span>
                        </div>
                    </div>
                </div>

                {/* Feature cards */}
                <div className={styles.cardsRow}>
                    {FEATURE_CARDS.map((card) => (
                        <div key={card.label} className={styles.featureCard}>
                            <span className={styles.cardIcon}>{card.icon}</span>
                            <span className={styles.cardLabel}>{card.label}</span>
                        </div>
                    ))}
                </div>

                {/* Hint animado */}
                <p className={styles.hint}>
                    <span className={styles.hintArrow}>←</span> Seleccioná una conversación
                </p>
            </div>
        );
    }

    return <SidebarDmsMobile dms={dms} />;
}
