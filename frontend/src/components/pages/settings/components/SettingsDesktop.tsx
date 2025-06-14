import { useState } from 'react';
import styles from '../../../../styles/modules/Settings.module.css'
import { useTranslation } from 'react-i18next';
import SelectLanguage from './SelectLanguage';
import SelectTheme from './SelectTheme';
import AccountSettings from './AccountSettings';


export default function SettingsDesktop() {
    const [activeSection, setActiveSection] = useState<"language" | "theme" | "account">("account");
    const { t } = useTranslation();

    return (
        <div className={styles.body}>
            <section className={styles.menu}>
                <nav>
                    <ul>
                        <li
                            className={activeSection === "account" ? styles.active : ""}
                            onClick={() => setActiveSection("account")}
                        >
                            {t("settings.menu.sesion")}
                        </li>
                        <li
                            className={activeSection === "language" ? styles.active : ""}
                            onClick={() => setActiveSection("language")}
                        >
                            {t("settings.menu.language")}
                        </li>
                        <li
                            className={activeSection === "theme" ? styles.active : ""}
                            onClick={() => setActiveSection("theme")}
                        >
                            {t("settings.menu.theme")}
                        </li>
                    </ul>
                </nav>
            </section>

            <section className={styles.content}>
                {activeSection === "language" && <SelectLanguage />}
                {activeSection === "theme" && <SelectTheme />}
                {activeSection === "account" && <AccountSettings />}
            </section>
        </div>
    )
}