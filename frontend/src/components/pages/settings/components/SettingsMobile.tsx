import SettingsMobileMenu from "./mobile/SettingsMobileMenu";
import styles from '../css/SettingsMobile.module.css';
import { Outlet, useLocation } from "react-router-dom";

export default function SettingsMobile() {
    const location = useLocation();
    const isRoot = location.pathname === '/settings';

    return (
        <div className={styles.container}>
            <div className={`${styles.menuPanel} ${!isRoot ? styles.slideLeft : ''}`}>
                <SettingsMobileMenu />
            </div>
            <div className={`${styles.outletPanel} ${!isRoot ? styles.showOutlet : ''}`}>
                <Outlet />
            </div>
        </div>
    );
}