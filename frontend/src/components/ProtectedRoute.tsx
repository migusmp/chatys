import { useEffect, useState, type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";


export default function ProtectedRoute({ children }: { children: JSX.Element }) {
    const [ auth, setAuth ] = useState<boolean | null>(null);
    
    const location = useLocation()

    // Verificar que el usuario esta autenticado
    useEffect(() => {
        fetch('/api/user/info', { method: "GET", credentials: "include" })
            .then(res => {
                if (res.status === 200) setAuth(true)
                else setAuth(false)
            })
            .catch(() => setAuth(false))
    }, [])

    // pantalla de carga
    if (auth === null) return <div>Cargando...</div>

    if (auth && (location.pathname === '/login' || location.pathname === '/register')) {
        return <Navigate to="/" replace />
    }

    if (!auth && location.pathname !== '/login' && location.pathname !== '/register') {
        return <Navigate to="/login" replace />
    }

    return children
}