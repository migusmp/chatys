import { NavLink, Outlet, useParams } from 'react-router-dom'
import styles from '../../../styles/modules/Profile.module.css'
import { useTranslation } from 'react-i18next';

export default function Profile() {
    const { username } = useParams();
    const { t } = useTranslation();



    return (
        <>
            <div className={styles.body}>
                <section className={styles.userInfoSection}>
                    {/* SECTION TO BANNER IMAGE */}
                    <section className={styles.header}></section>

                    {/* SECTION TO SHOW USER INFORMATION */}
                    <section className={styles.userInfo}>
                        <div className={styles.div}>
                            <div className={styles.profileImgDiv}></div>
                            <button className={styles.buttonEditProfile}>{t("profile.editProfile")}</button>
                        </div>

                        <div className={styles.userDetails}>
                            <span className={styles.spanName}>{username} de prueba</span>
                            <span className={styles.spanUserName}>@{username}</span>
                            <span className={styles.spanJoined}><i className="bi bi-calendar3"></i>{t("profile.joinedIn")} June 2025</span>
                            <span className={styles.spanFriends}>
                                <strong>20</strong>
                                {t("profile.countFriends")}
                            </span>
                        </div>

                        {/* Navegación con <ul> */}
                    <ul className={styles.navList}>
                        <li>
                            <NavLink
                                to="."
                                end
                                className={({ isActive }) => isActive ? styles.activeLink : styles.inactiveLink}
                            >
                                {t("profile.posts")}
                                <div className={styles.underline}></div>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="friends"
                                className={({ isActive }) => isActive ? styles.activeLink : styles.inactiveLink}
                            >
                                {t("profile.friends")}
                                <div className={styles.underline}></div>
                            </NavLink>
                        </li>
                    </ul>
                    </section>

                    {/* SECTION TO CHANGE page to show */}
                    <section>
                        <Outlet />
                    </section>

                </section>

            </div>
        </>
    )
}