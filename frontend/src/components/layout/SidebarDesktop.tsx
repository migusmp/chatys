import { Link, useLocation } from "react-router-dom";
import {
    useNotificationsContext,
    useUserProfileContext,
} from "../../context/UserContext";
import { useTranslation } from "react-i18next";
import chatysLogo from '../../assets/chatys-logo-official.png';
import { useEffect, useRef, useState } from "react";
import LogoutDesktop from "./LogoutDesktop";
import NotificationIcon from "../bar_icons/NotificationIcon";

export default function SidebarDesktop() {
    const { dmNotifications } = useNotificationsContext();
    const { user } = useUserProfileContext();
    const location = useLocation();
    const { t } = useTranslation();

    const [logout, setLogout] = useState(false);
    const logoutRef = useRef<HTMLDivElement>(null); // Ref para el menú de logout

    // Contador solo de chat_message y NEW_DM_MESSAGE
    const unreadChatsCount = dmNotifications.filter(
        n => n.type_msg === "chat_message" || n.type_msg === "NEW_DM_MESSAGE"
    ).length;

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    function handleUserProfileClick() {
        setLogout((prev) => !prev);
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (logoutRef.current && !logoutRef.current.contains(event.target as Node)) {
                setLogout(false);
            }
        }

        if (logout) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [logout]);

    return (
        <aside className="sidebar">
            <div className='sidebar-content'>
                <div className="sidebar-top">
                    <div className="logo">
                        <img src={chatysLogo} alt="chatys-logo" />
                    </div>

                    <nav className="menu">
                        <Link to="/" className={`link ${isActive('/') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/') ? 'bi-house-door-fill' : 'bi-house-door'}`}></i>
                            <span>{t("sidebar.home")}</span>
                        </Link>
                        <Link to="/friends" className={`link ${isActive('/friends') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/friends') ? 'bi-people-fill' : 'bi-people'}`}></i>
                            <span>{t("sidebar.friends")}</span>
                        </Link>
                        <Link to="/chats" className={`link ${isActive('/chats') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/chats') ? 'bi-chat-fill' : 'bi-chat'}`}></i>
                            <span>{t("sidebar.chats")}</span>
                        </Link>
                        <Link to="/servers" className={`link ${isActive('/servers') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/servers') ? 'bi-globe-fill' : 'bi-globe'}`}></i>
                            <span>{t("sidebar.servers")}</span>
                        </Link>
                        <Link to="/dm" className={`link ${isActive('/dm') ? 'active' : ''}`}>
                            <div className="icon-with-badge">
                                <i className={`bi ${isActive('/dm') ? 'bi-send-fill' : 'bi-send'}`}></i>
                                {unreadChatsCount > 0 && (
                                    <article className="badge">{unreadChatsCount > 9 ? '9+' : unreadChatsCount}</article>
                                )}
                            </div>
                            <span>{t("sidebar.messages")}</span>
                        </Link>
                        <NotificationIcon hasText={true} />
                        <Link to={`/profile/${user?.username}`} className={`link ${isActive(`/profile/${user?.username}`) ? 'active' : ''}`}>
                            <i className={`bi ${isActive(`/profile/${user?.username}`) ? 'bi-person-fill' : 'bi-person'}`}></i>
                            <span>{t("sidebar.profile")}</span>
                        </Link>
                        <Link to="/settings" className={`link ${isActive('/settings') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/settings') ? 'bi-gear-fill' : 'bi-gear'}`}></i>
                            <span>{t("sidebar.settings")}</span>
                        </Link>
                    </nav>
                </div>
            </div>

            {logout && (
                <div ref={logoutRef}>
                    <LogoutDesktop />
                </div>
            )}

            <div className="profile" onClick={handleUserProfileClick}>

                <img src={user?.image || `"default.png"`} alt={user?.username || "Usuario"} />
                <div className="info">
                    <strong className="name">{user?.name || "Nombre"}</strong>
                    <span className="username">@{user?.username || "usuario"}</span>
                </div>
            </div>
        </aside>
    )
}
