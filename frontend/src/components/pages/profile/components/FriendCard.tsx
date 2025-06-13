import type { Friend } from '../../../../types/friend'
import styles from '../css/Friends.module.css'

export default function FriendCard({ friend }: { friend: Friend }) {
  return (
    <div className={styles.friendCard}>
      <img 
        src={friend.image} 
        alt={friend.name} 
      />
      <div>
        <div className={styles.name}>{friend.name}</div>
        <div className={styles.username}>@{friend.username}</div>
      </div>
    </div>
  )
}
