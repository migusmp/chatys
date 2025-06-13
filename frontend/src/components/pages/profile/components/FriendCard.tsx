import styles from '../css/Friends.module.css'

type Friend = {
  id: string
  name: string
  username: string
  profileImage: string
}

export default function FriendCard({ friend }: { friend: Friend }) {
  return (
    <div className={styles.friendCard}>
      <img 
        src={friend.profileImage} 
        alt={friend.name} 
      />
      <div>
        <div className={styles.name}>{friend.name}</div>
        <div className={styles.username}>@{friend.username}</div>
      </div>
    </div>
  )
}
