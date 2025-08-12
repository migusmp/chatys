import type { NewDmMessageNotification } from '../../../../interfaces/notifications';
import styles from '../css/ChatMessageNotification.module.css';

export default function ChatMessageNotificationRealTime({ n }: { n: NewDmMessageNotification }) {
  return (
    <div className={styles.notificationContainer}>
      <img
        className={styles.profileImage}
        src={`/media/user/${n.from_user_image}`}
        alt={`profile-image-${n.from_user_username}`}
      />
      <div className={styles.messageContent}>
        <p className={styles.sender}>
          {n.from_user_username} <strong>sent a message:</strong>
        </p>
        <div className={styles.messageBubble}>
          <p className={styles.messageText}>{n.content}</p>
          <p className={styles.timestamp}>
            {new Date(n.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}