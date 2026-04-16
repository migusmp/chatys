import { Link, useLocation } from "react-router-dom";
import {
    useNotificationsContext,
    useUserProfileContext,
} from "../../context/UserContext";

export default function SidebarMovile() {
    const { user } = useUserProfileContext()
    const location = useLocation();
    const { dmNotifications } = useNotificationsContext();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <aside className="mobile-sidebar">
            <div className="mobile-sidebar__container">
                <nav className="mobile-sidebar__menu">
                    <Link to="/" className={`mobile-sidebar__link ${isActive('/') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/') ? 'bi-house-door-fill' : 'bi-house-door'}`}></i>
                    </Link>
                    <Link to="/chats" className={`mobile-sidebar__link ${isActive('/chats') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/chats') ? 'bi-chat-fill' : 'bi-chat'}`}></i>
                    </Link>
                    <Link to="/servers" className={`mobile-sidebar__link ${isActive('/servers') ? 'active' : ''}`}>
                        <svg 
                            width="24" 
                            height="24" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                    </Link>
                    <Link to="/dm" className={`mobile-sidebar__link ${isActive('/dm') ? 'active' : ''}`}>
                        <div className="icon-with-badge">
                            <i className={`bi ${isActive('/dm') ? 'bi-send-fill' : 'bi-send'}`}></i>
                            {dmNotifications.length > 0 && (
                                <span className="badge">{dmNotifications.length > 9 ? '9+' : dmNotifications.length}</span>
                            )}
                        </div>
                    </Link>
                    <Link to={`/profile/${user?.username}`} className={`mobile-sidebar__link ${isActive(`/profile/${user?.username}`) ? 'active' : ''}`}>
                        <i className={`bi ${isActive(`/profile/${user?.username}`) ? 'bi-person-fill' : 'bi-person'}`}></i>
                    </Link>
                    <Link to="/settings" className={`mobile-sidebar__link ${isActive('/settings') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/settings') ? 'bi-gear-fill' : 'bi-gear'}`}></i>
                    </Link>
                </nav>
            </div>
        </aside>
    )
}
