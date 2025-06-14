import { useNavigate } from 'react-router-dom';
import styles from './css/SettingsMobile.module.css';
import useIsMobile from '../../../hooks/useIsMobile';

export default function SettingsPageLayout({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    return (
        <div className={styles.outletPage}>
            {isMobile && (
                <button className={styles.backButton} onClick={() => navigate('/settings')}>
                    <i className="bi bi-arrow-left"></i>
                </button>
            )}
            <div className={isMobile ? styles.pageContent : ''}>
                {children}
            </div>
        </div>
    )
}