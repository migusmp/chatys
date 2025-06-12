import SelectLanguage from "./components/SelectLanguage";
import SelectTheme from "./components/SelectTheme";
import styles from '../../../styles/modules/Settings.module.css';
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Settings() {
  const [activeSection, setActiveSection] = useState<"language" | "theme">("language");
  const { t } = useTranslation();

  return (
    <div className={styles.body}>
      <section className={styles.menu}>
        <nav>
          <ul>
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
      </section>
    </div>
  );
}
