import { useTranslation } from "react-i18next"
import styles from '../css/AccountSettings.module.css'

export default function AccountSettings() {
    const { t } = useTranslation()

    return (
        <div className={styles.sectionLogout}>
            <button className={styles.logoutBtn}>{t("settings.sesion.logoutBtn")}</button>
            <small className="">{t("settings.sesion.descriptionLogoutBtn")}</small>
        </div>
    )
}