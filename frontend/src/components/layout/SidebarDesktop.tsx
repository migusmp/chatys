import { Link, useLocation } from "react-router-dom";
import { useUserContext } from "../../context/UserContext";
import { useTranslation } from "react-i18next";
import chatysLogo from '../../assets/chatys-logo-official.png';

export default function SidebarDesktop() {
    const { user } = useUserContext();
    const location = useLocation();
    const { t } = useTranslation();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    const userNamePruebaProfile = "test";

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
                        <Link to="/dm" className={`link ${isActive('/dm') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/dm') ? 'bi-send-fill' : 'bi-send'}`}></i>
                            <span>{t("sidebar.messages")}</span>
                        </Link>
                        <Link to="/notifications" className={`link ${isActive('/notifications') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/notifications') ? 'bi-bell-fill' : 'bi-bell'}`}></i>
                            <span>{t("sidebar.notifications")}</span>
                        </Link>
                        <Link to={`/profile/${userNamePruebaProfile}`} className={`link ${isActive(`/profile/${userNamePruebaProfile}`) ? 'active' : ''}`}>
                            <i className={`bi ${isActive(`/profile/${userNamePruebaProfile}`) ? 'bi-person-fill' : 'bi-person'}`}></i>
                            <span>{t("sidebar.profile")}</span>
                        </Link>
                        <Link to="/settings" className={`link ${isActive('/settings') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/settings') ? 'bi-gear-fill' : 'bi-gear'}`}></i>
                            <span>{t("sidebar.settings")}</span>
                        </Link>
                    </nav>
                </div>
            </div>
            <div className="profile">
                <img src={user?.image || `"default.png"`} alt={user?.username || "Usuario"} />
                <div className="info">
                    <strong className="name">{user?.name || "Nombre"}</strong>
                    <span className="username">@{user?.username || "usuario"}</span>
                </div>
                <button className="more">
                    <i className="bi bi-three-dots"></i>
                </button>
            </div>
        </aside>
    )
}