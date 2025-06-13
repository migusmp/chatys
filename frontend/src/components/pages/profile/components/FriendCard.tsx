import { useNavigate } from 'react-router-dom';
import type { Friend } from '../../../../types/friend'
import styles from '../css/Friends.module.css'

export default function FriendCard({ friend }: { friend: Friend }) {
  const navigate = useNavigate();

  function handleOnClick() {
    // Navegar al perfil del usuario con su username
    navigate(`/profile/${friend.username}`);
  }

  return (
    <div className={styles.friendCard} onClick={handleOnClick} style={{ cursor: 'pointer' }}>
      <img 
        src={friend.image} 
        alt={friend.name} 
      />
      <div>
        <div className={styles.name}>{friend.name}</div>
        <div className={styles.username}>@{friend.username}</div>
      </div>
    </div>
  );
}
