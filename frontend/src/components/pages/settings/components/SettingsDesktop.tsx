import styles from '../../../../styles/modules/Settings.module.css'
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';


export default function SettingsDesktop() {
    const { t } = useTranslation();

    const navigate = useNavigate();
    const location = useLocation();

    const getSectionFromPath = () => {
        const path = location.pathname.split("/").pop(); // account | language | theme
        if (path === "language" || path === "theme" || path === "account") return path;
        return "account";
    };
    const activeSection = getSectionFromPath();

    return (
        <div className={styles.body}>
            <section className={styles.menu}>
                <nav>
                    <ul>
                        <li
                            className={activeSection === "account" ? styles.active : ""}
                            onClick={() => navigate("account")}
                        >
                            {t("settings.menu.sesion")}
                        </li>
                        <li
                            className={activeSection === "language" ? styles.active : ""}
                            onClick={() => navigate("language")}
                        >
                            {t("settings.menu.language")}
                        </li>
                        <li
                            className={activeSection === "theme" ? styles.active : ""}
                            onClick={() => navigate("theme")}
                        >
                            {t("settings.menu.theme")}
                        </li>
                    </ul>
                </nav>
            </section>

            <section className={styles.content}>
                <Outlet />
            </section>
        </div>
    )
}