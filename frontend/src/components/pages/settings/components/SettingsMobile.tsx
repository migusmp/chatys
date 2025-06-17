import SettingsMobileMenu from "./mobile/SettingsMobileMenu";
import styles from '../css/SettingsMobile.module.css';
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function SettingsMobile() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isRoot = location.pathname === '/settings';

    const handleGoBack = () => {
        const lastURL = sessionStorage.getItem("lastNonSettingsURL");

        if (lastURL && !lastURL.startsWith('/settings')) {
            navigate(lastURL);
            sessionStorage.removeItem("lastNonSettingsURL"); // opcional: borra después de usarlo
        } else {
            navigate('/'); // fallback
        }
    };

    return (
        <div className={styles.container}>
            <div className={`${styles.menuPanel} ${!isRoot ? styles.slideLeft : ''}`}>
                <section className={styles.sectionBackBtn}>
                    <button onClick={handleGoBack} className={styles.backButtonSettings}>
                        <i className="bi bi-arrow-left"></i> {t("settingsMobile.menu.backBtn")}
                    </button>
                </section>
                <SettingsMobileMenu />
            </div>
            <div className={`${styles.outletPanel} ${!isRoot ? styles.showOutlet : ''}`}>
                <Outlet />
            </div>
        </div>
    );
}
