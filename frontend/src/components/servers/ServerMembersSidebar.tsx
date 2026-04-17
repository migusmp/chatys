import { useEffect, useState } from "react";
import useServerStore from "../../stores/useServerStore";
import type { ServerMember } from "../../stores/useServerStore";
import { useUserProfileContext } from "../../context/UserContext";
import styles from "./css/ServerMembersSidebar.module.css";

// ─── MemberCard ───────────────────────────────────────────────────────────────

interface CardProps {
    member: ServerMember;
    isYou: boolean;
    canKick: boolean;
    kicking: boolean;
    onKick: () => void;
}

function MemberCard({ member: m, isYou, canKick, kicking, onKick }: CardProps) {
    return (
        <div className={styles.item}>
            {/* Avatar */}
            <div className={styles.avatarWrap}>
                {m.image ? (
                    <img
                        src={`/media/user/${m.image}`}
                        alt={m.username}
                        className={styles.avatar}
                    />
                ) : (
                    <div className={styles.avatarPlaceholder}>
                        {m.username.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className={styles.info}>
                <span className={`${styles.username} ${isYou ? styles.isYou : ""}`}>
                    {m.username}
                    {isYou ? " (vos)" : ""}
                </span>
            </div>

            {/* Kick (admin only, not on owner or self) */}
            {canKick && (
                <button
                    type="button"
                    className={styles.kickBtn}
                    title={`Expulsar a ${m.username}`}
                    disabled={kicking}
                    onClick={onKick}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

// ─── ServerMembersSidebar ─────────────────────────────────────────────────────

export default function ServerMembersSidebar() {
    const { user } = useUserProfileContext();
    const activeServer = useServerStore((s) => s.activeServer);
    const members      = useServerStore((s) => s.members);
    const fetchMembers = useServerStore((s) => s.fetchMembers);
    const kickMember   = useServerStore((s) => s.kickMember);

    const [kicking, setKicking] = useState<number | null>(null);

    useEffect(() => {
        if (activeServer) {
            fetchMembers(activeServer.id);
        }
    }, [activeServer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!activeServer) return null;

    const serverMembers: ServerMember[] = members[activeServer.id] ?? [];

    const isAdmin =
        activeServer.member_role === "owner" ||
        activeServer.member_role === "admin";

    const owners  = serverMembers.filter((m) => m.role === "owner");
    const admins  = serverMembers.filter((m) => m.role === "admin");
    const regular = serverMembers.filter((m) => m.role === "member");

    const handleKick = async (userId: number) => {
        setKicking(userId);
        try {
            await kickMember(activeServer.id, userId);
        } catch {
            // ignore
        } finally {
            setKicking(null);
        }
    };

    const renderGroup = (label: string, group: ServerMember[]) => {
        if (group.length === 0) return null;
        return (
            <div className={styles.group} key={label}>
                <p className={styles.groupLabel}>{label}</p>
                {group.map((m) => (
                    <MemberCard
                        key={m.user_id}
                        member={m}
                        isYou={m.user_id === user?.id}
                        canKick={isAdmin && m.role !== "owner" && m.user_id !== user?.id}
                        kicking={kicking === m.user_id}
                        onKick={() => handleKick(m.user_id)}
                    />
                ))}
            </div>
        );
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <p className={styles.title}>
                    Miembros
                    <span className={styles.count}>{serverMembers.length}</span>
                </p>
            </div>

            <div className={styles.list}>
                {renderGroup("Owner", owners)}
                {renderGroup("Admins", admins)}
                {renderGroup("Miembros", regular)}

                {serverMembers.length === 0 && (
                    <p className={styles.empty}>Sin miembros aún.</p>
                )}
            </div>
        </aside>
    );
}
