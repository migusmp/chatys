import '../../styles/layouts/Sidebar.css';
import chatysLogo from '../../assets/chatys-logo-official.png';
import { useUserContext } from '../../context/UserContext';
import { Link } from 'react-router-dom';

export default function Sidebar() {
    const { user } = useUserContext();

    console.log("USEERR:", user);

    return (
        <aside className="sidebar">
            <div className='sidebar-content'>
                <div className="sidebar-top">
                    <div className="logo">
                        <img src={chatysLogo} alt="chatys-logo" />
                    </div>

                    <nav className="menu">
                        <Link to="/" className='link'>
                            <i className="bi bi-house-door"></i>
                            Inicio
                        </Link>
                        <Link to="/friends" className='link'>
                            <i className="bi bi-people"></i>
                            Amigos
                        </Link>
                        <Link to="/chats" className='link'>
                            <i className="bi bi-chat"></i>
                            Chats
                        </Link>
                        <Link to="/dm" className='link'>
                            <i className="bi bi-send"></i>
                            Mensajes
                        </Link>
                        <Link to="/notifications" className='link'>
                            <i className="bi bi-bell"></i>
                            Notificaciones
                        </Link>
                        <Link to="/profile" className='link'>
                            <i className="bi bi-person"></i>
                            Perfil
                        </Link>
                        <Link to="/settings" className='link'>
                            <i className="bi bi-gear"></i>
                            Ajustes
                        </Link>
                    </nav>
                </div>
            </div>
            {/* Parte superior: logo + menú */}


            {/* Parte inferior: perfil */}
            <div className="profile">
                <img src={user?.image || "/avatar.png"} alt={user?.username || "Usuario"} />
                <div className="info">
                    <span className="name">{user?.name || "Nombre"}</span>
                    <span className="username">@{user?.username || "usuario"}</span>
                </div>
                <button className="more">
                    <i className="bi bi-three-dots"></i>
                </button>
            </div>
        </aside>
    );
}
