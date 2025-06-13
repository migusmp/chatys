import { useTranslation } from "react-i18next";
import styles from '../../../../styles/modules/Settings.module.css'
import { useState } from "react";

export default function SelectLanguage() {
  const { i18n } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(i18n.language);
  const { t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    setSelectedLang(lang);
  };

  return (
    <div className={styles.languageSelector}>
      <label htmlFor="language-select" className={styles.label}>
        🌍 {t("settings.language.changeLanguage")}
      </label>
      <select
        id="language-select"
        value={selectedLang}
        onChange={handleChange}
        className={styles.select}
      >
        <option value="en">🇬🇧 English</option>
        <option value="es">🇪🇸 Español</option>
      </select>
    </div>
  );
}