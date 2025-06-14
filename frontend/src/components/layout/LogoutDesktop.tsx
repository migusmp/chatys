import { useTranslation } from 'react-i18next';
import styles from '../../styles/modules/LogoutDesktop.module.css';
import useUser from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../../context/UserContext';

export default function LogoutDesktop() {
    const { t } = useTranslation();
    const { logout } = useUser();
    const { user } = useUserContext();
    const navigate = useNavigate(); // Hook de navegación

    async function handleLogoutClick () {
        const log_out = await logout();
        if (log_out) {
            navigate('/login'); // Redirige al login
        }
    }

    return (
        <section className={styles.sectionLogout}>
            <button onClick={handleLogoutClick}>
                {t("sidebar.logout")} @{user?.username}
            </button>
        </section>
    );
}