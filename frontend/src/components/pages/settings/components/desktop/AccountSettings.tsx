import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import styles from '../../css/AccountSettings.module.css';
import ModalLogout from "./ModalLogout";
import { useUserProfileContext } from "../../../../../context/UserContext";
import SettingsPageLayout from "../../SettingsPageLayout";

export default function AccountSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser, logout } = useUserProfileContext();

  const [showModal, setShowModal] = useState(false);

  const handleLogoutClick = () => {
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);

    const loggedOut = await logout();
    if (loggedOut) {
      setUser(null);
      navigate('/login');
    } else {
      // Aquí puedes manejar errores si el logout falla, si quieres
      alert(t("settings.sesion.logoutFailed") || "Logout failed. Please try again.");
    }
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <SettingsPageLayout>
      <div className={styles.sectionLogout}>
        <button className={styles.logoutBtn} onClick={handleLogoutClick}>
          {t("settings.sesion.logoutBtn")}
        </button>
        <small>{t("settings.sesion.descriptionLogoutBtn")}</small>

        {showModal && (
          <ModalLogout
            message={t("settings.sesion.logoutModal.message") || "Are you sure you want to logout?"}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            confirmText={t("settings.sesion.logoutModal.confirm") || "Yes"}
            cancelText={t("settings.sesion.logoutModal.cancel") || "No"}
          />
        )}
      </div>
    </SettingsPageLayout>

  );
}
