import { Link, useLocation } from "react-router-dom";
import { useNotificationsContext } from "../../context/UserContext";
import { useTranslation } from "react-i18next";

export default function NotificationIcon({ hasText = false }) {
  const { notifications } = useNotificationsContext();
  const { t } = useTranslation();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const active = isActive('/notifications');

  const iconWithBadgeStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "-6px",
    right: "-7px",
    backgroundColor: "#ff563c",
    color: "#ffffff",
    fontSize: "0.65rem",
    fontWeight: "bold",
    padding: "2px 6px",
    borderRadius: "50%",
    minWidth: "20px",
    textAlign: "center",
  };

  return (
    <Link to="/notifications" className={`link ${active ? 'active' : ''}`} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
      <div style={iconWithBadgeStyle}>
        <i className={`bi ${active ? 'bi-bell-fill' : 'bi-bell'}`} style={{ display: "flex", fontSize: "1.7rem", opacity: active ? 1 : 0.75, color: active ? "#00ff66" : "white" }}></i>
        {notifications.length > 0 && (
          <span style={badgeStyle}>{notifications.length}</span>
        )}
      </div>
      {
        hasText && <span>{t("sidebar.notifications")}</span>
      }
    </Link>
  )
}
