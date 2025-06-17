import { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Loader from "./Loader";
import { useUserContext } from "../context/UserContext";


export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useUserContext();
  const location = useLocation();

  if (loading) return <Loader />;

  // Si usuario está logueado y está en login o register, redirigir a home
  if (user && (location.pathname === "/login" || location.pathname === "/register")) {
    return <Navigate to="/" replace />;
  }

  // Si no hay usuario y no está en login o register, redirigir a login
  if (!user && location.pathname !== "/login" && location.pathname !== "/register") {
    return <Navigate to="/login" replace />;
  }

  return children;
}