import { NavLink, Outlet, useParams } from 'react-router-dom'

import styles from '../../../styles/modules/Profile.module.css'

import { useTranslation } from 'react-i18next';
import useFetch from '../../../hooks/useFetch';
import { useEffect, useState } from 'react';
import type { ProfileData } from '../../../types/user';
import { useUserContext } from '../../../context/UserContext';
import i18n from '../../../i18n';

export default function Profile() {
    const { username } = useParams();
    const { user } = useUserContext();

    const [profile, setProfile] = useState<ProfileData>();

    const joinedDate = new Date(profile?.created_at ?? '');
    const joinedIn = joinedDate.toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
    });

    const { t } = useTranslation();
    const { fetchProfileUserData } = useFetch();

    const fetchProfile = async () => {
        if (!username) return;
        try {
            const data = await fetchProfileUserData(username);
            if (data) {
                setProfile(data);
            }
        } catch (e) {
            console.error("Error al cargar el perfil del usuario");
        }
    }

    useEffect(() => {
        fetchProfile();
    }, [username]);


    return (
        <>
            <div className={styles.body}>
                <section className={styles.userInfoSection}>
                    {/* SECTION TO BANNER IMAGE */}
                    <section className={styles.header}></section>

                    {/* SECTION TO SHOW USER INFORMATION */}
                    <section className={styles.userInfo}>
                        <div className={styles.div}>
                            <div className={styles.profileImgDiv}>
                                <img src={profile?.image} alt={`${profile?.username}-profile-image`} />
                            </div>
                            {username != user?.username ? '' : <button className={styles.buttonEditProfile}>{t("profile.editProfile")}</button>}

                        </div>

                        <div className={styles.userDetails}>
                            <span className={styles.spanName}>{profile?.name}</span>
                            <span className={styles.spanUserName}>@{profile?.username}</span>
                            {profile?.description ? <span className={styles.spanDescription}>{profile?.description}</span> : ''}
                            <span className={styles.spanJoined}><i className="bi bi-calendar3"></i>{t("profile.joinedIn")} {joinedIn}</span>
                            <span className={styles.spanFriends}>
                                <strong>{profile?.friends_count}</strong>
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