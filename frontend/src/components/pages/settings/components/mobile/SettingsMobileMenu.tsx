import styles from '../../css/SettingsMobile.module.css'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function SettingsMobileMenu() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const base = "/settings";
    const sections = [
        { name: t("settings.menu.sesion"), path: `${base}/account` },
        { name: t("settings.menu.language"), path: `${base}/language` },
        { name: t("settings.menu.theme"), path: `${base}/theme` },
    ];

    return (
        <div className={styles.body}>
            <ul className={styles.menuList}>
                {sections.map(section => (
                    <li key={section.path} onClick={() => navigate(section.path)} className={styles.menuItem}>
                        <span>{section.name}</span>
                        <span className={styles.arrow}>&#x276F;</span> {/* Unicode flecha → */}
                    </li>
                ))}
            </ul>
        </div>
    )
}