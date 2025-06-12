import '../../styles/layouts/Sidebar.css';
import chatysLogo from '../../assets/chatys-logo-official.png';
import { useUserContext } from '../../context/UserContext';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
    const { user } = useUserContext();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

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
                            Inicio
                        </Link>
                        <Link to="/friends" className={`link ${isActive('/friends') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/friends') ? 'bi-people-fill' : 'bi-people'}`}></i>
                            Amigos
                        </Link>
                        <Link to="/chats" className={`link ${isActive('/chats') ? 'active' : ''}`}>
                            <i  className={`bi ${isActive('/chats') ? 'bi-chat-fill' : 'bi-chat'}`}></i>
                            Chats
                        </Link>
                        <Link to="/dm" className={`link ${isActive('/dm') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/dm') ? 'bi-send-fill' : 'bi-send' }`}></i>
                            Mensajes
                        </Link>
                        <Link to="/notifications" className={`link ${isActive('/notifications') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/notifications') ? 'bi-bell-fill' : 'bi-bell' }`}></i>
                            Notificaciones
                        </Link>
                        <Link to="/profile" className={`link ${isActive('/profile') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/profile') ? 'bi-person-fill' : 'bi-person' }`}></i>
                            Perfil
                        </Link>
                        <Link to="/settings" className={`link ${isActive('/settings') ? 'active' : ''}`}>
                            <i className={`bi ${isActive('/settings') ? 'bi-gear-fill' : 'bi-gear' }`}></i>
                            Ajustes
                        </Link>
                    </nav>
                </div>
            </div>
            {/* Parte superior: logo + menú */}


            {/* Parte inferior: perfil */}
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
    );
}
