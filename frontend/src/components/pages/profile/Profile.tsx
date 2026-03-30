import { NavLink, Outlet, useParams } from 'react-router-dom'

import styles from '../../../styles/modules/Profile.module.css'

import { useTranslation } from 'react-i18next';
import useFetch from '../../../hooks/useFetch';
import { useEffect, useState } from 'react';
import type { ProfileData } from '../../../types/user';
import { useUserProfileContext } from '../../../context/UserContext';
import i18n from '../../../i18n';
import BackButton from './components/BackButton';
import EditProfileModal from './components/EditProfileModal';

export default function Profile() {
    const { username } = useParams();
    const { user } = useUserProfileContext();

    let data;

    const [profile, setProfile] = useState<ProfileData>();
    const [modal, setModal] = useState<boolean>(false);

    const joinedDate = new Date(profile?.created_at ?? '');
    const joinedIn = joinedDate.toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
    });

    const { t } = useTranslation();
    const { fetchProfileUserData, fetchProfileUserLogued } = useFetch();

    const isUserLogued = user?.username == username ? true : false;

    function handleModalChange() {
        if (modal) {
            setModal(false)
        } else {
            setModal(true)
        }
    }

    const fetchProfile = async () => {
        if (!username) return;
        try {
            if (isUserLogued) {
                data = await fetchProfileUserLogued();
            } else {
                data = await fetchProfileUserData(username);
            }
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

    const avatarInitial = profile?.name ? profile.name.charAt(0).toUpperCase() : '?';

    return (
        <>
            {modal && (
                <EditProfileModal
                    setModal={setModal}
                    profile={profile}
                    setProfile={setProfile}
                />
            )}

            <div className={styles.page}>
                {/* Aurora background blob */}
                <div className={styles.auroraBlob} aria-hidden="true" />

                {/* Sticky back row */}
                <div className={styles.backRow}>
                    <BackButton name={profile?.name} />
                </div>

                {/* Hero card */}
                <div className={styles.heroWrap}>
                    <div className={styles.heroCard}>
                        {/* Avatar */}
                        <div className={styles.avatarWrap}>
                            {profile?.image ? (
                                <img
                                    className={styles.avatar}
                                    src={profile.image}
                                    alt={`${profile.username}-profile-image`}
                                />
                            ) : (
                                <div className={styles.avatarPlaceholder}>{avatarInitial}</div>
                            )}
                        </div>

                        {/* Identity */}
                        <div className={styles.identity}>
                            <h1 className={styles.displayName}>{profile?.name}</h1>
                            <span className={styles.handle}>@{profile?.username}</span>
                        </div>

                        {/* Bio */}
                        {profile?.description && (
                            <p className={styles.bio}>{profile.description}</p>
                        )}

                        {/* Stats pills */}
                        <div className={styles.statsRow}>
                            <span className={styles.statPill}>
                                <i className="bi bi-people" />
                                <strong>{profile?.friends_count}</strong>
                                &nbsp;{t("profile.countFriends")}
                            </span>
                            <span className={styles.statPill}>
                                <i className="bi bi-calendar3" />
                                {t("profile.joinedIn")} {joinedIn}
                            </span>
                        </div>

                        {/* Edit button */}
                        {isUserLogued && (
                            <button onClick={handleModalChange} className={styles.editBtn}>
                                {t("profile.editProfile")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.tabsWrap}>
                    <nav className={styles.tabs}>
                        <NavLink
                            to="."
                            end
                            className={({ isActive }) =>
                                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                            }
                        >
                            {t("profile.posts")}
                        </NavLink>
                        <NavLink
                            to="friends"
                            className={({ isActive }) =>
                                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                            }
                        >
                            {t("profile.friends")}
                        </NavLink>
                    </nav>
                </div>

                {/* Content */}
                <div className={styles.contentWrap}>
                    <Outlet />
                </div>
            </div>
        </>
    )
}
