import { Link, useLocation } from "react-router-dom";

export default function SidebarMovile() {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');


    const userNamePruebaProfile = "test";
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
                    <Link to="/dm" className={`mobile-sidebar__link ${isActive('/dm') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/dm') ? 'bi-send-fill' : 'bi-send'}`}></i>
                    </Link>
                    <Link to="/notifications" className={`mobile-sidebar__link ${isActive('/notifications') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/notifications') ? 'bi-bell-fill' : 'bi-bell'}`}></i>
                    </Link>
                    <Link to={`/profile/${userNamePruebaProfile}`} className={`mobile-sidebar__link ${isActive(`/profile/${userNamePruebaProfile}`) ? 'active' : ''}`}>
                            <i className={`bi ${isActive(`/profile/${userNamePruebaProfile}`) ? 'bi-person-fill' : 'bi-person'}`}></i>
                        </Link>
                    <Link to="/settings" className={`mobile-sidebar__link ${isActive('/settings') ? 'active' : ''}`}>
                        <i className={`bi ${isActive('/settings') ? 'bi-gear-fill' : 'bi-gear'}`}></i>
                    </Link>
                </nav>
            </div>
        </aside>
    )
}