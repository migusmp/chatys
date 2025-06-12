import '../../styles/layouts/Sidebar.css';
import chatysLogo from '../../assets/chatys-logo-official.png';
import { useUserContext } from '../../context/UserContext';

export default function Sidebar() {
    const { user } = useUserContext();

    console.log("USEERR:", user);

    return (
        <aside className="sidebar">
            {/* Parte superior: logo + menú */}
            <div className="sidebar-top">
                <div className="logo">
                    <img src={chatysLogo} alt="chatys-logo" />
                </div>

                <nav className="menu">
                    <a href="/">
                        <i className="bi bi-house-door"></i>
                        Inicio
                    </a>
                    <a href="/friends">
                        <i className="bi bi-people"></i>
                        Amigos
                    </a>
                    <a href="/chats">
                        <i className="bi bi-chat"></i>
                        Chats
                    </a>
                    <a href="/dm">
                        <i className="bi bi-send"></i>
                        Mensajes
                    </a>
                    <a href="/notifications">
                        <i className="bi bi-bell"></i>
                        Notificaciones
                    </a>
                    <a href="/settings">
                        <i className="bi bi-gear"></i>
                        Ajustes
                    </a>
                </nav>
            </div>

            {/* Parte inferior: perfil */}
            <div className="profile">
                <img src={user?.image || "/avatar.png"} alt={user?.username || "Usuario"} />
                <div className="info">
                    <span className="name">{user?.name || "Nombre"}</span>
                    <span className="username">@{user?.username || "usuario"}</span>
                </div>
                <button className="more">⋯</button>
            </div>
        </aside>
    );
}
