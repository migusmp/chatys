import FriendCard from './FriendCard'
import styles from '../css/Friends.module.css'

import useFetch from '../../../../hooks/useFetch'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Friend } from '../../../../types/friend'
import { useTranslation } from 'react-i18next'

export default function Friends() {
    const { username } = useParams();
    const { fetchFriendsList } = useFetch();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true); // 👈 estado de carga

    const { t } = useTranslation();

    const fetchFriends = async () => {
        if (!username) return;
        setLoading(true); // 👈 empezamos a cargar
        try {
            const data = await fetchFriendsList(username);
            if (data) {
                setFriends(data);
            }
        } catch (error) {
            console.error('Error fetching friends:', error);
        } finally {
            setLoading(false); // 👈 carga terminada
        }
    };

    //     h2 {
    //     font-size: 2rem;
    //     color: #999;
    // }

    useEffect(() => {
        fetchFriends();
    }, []);

    return (
        <section className={styles.sectionFriends}>
            {loading ? (
                <div className={styles.loader}></div> // 👈 loader
            ) : friends.length > 0 ? (
                friends.map(friend => (
                    <FriendCard key={friend.id} friend={friend} />
                ))
            ) : (
                <>
                    <h2 style={{ color: '#999', fontSize: '1.5rem' }}>{t("profile.friendsSection.noFriendsMessage")}</h2>
                    <i
                        className="bi bi-person-fill-x"
                        style={{
                            fontSize: '3rem',
                            color: '#00ff66',
                            opacity: 0.6,
                        }}
                    ></i>
                </>
            )}
        </section>
    );
}