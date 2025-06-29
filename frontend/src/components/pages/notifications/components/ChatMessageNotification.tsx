import type { ChatMessageNotification } from "../../../../interfaces/notifications";
import styles from '../css/ChatMessageNotification.module.css';

interface Props {
  n: ChatMessageNotification;
}

export default function ChatMessageNotification({ n }: Props) {
  return (
    <div className={styles.notificationContainer}>
      <img
        className={styles.profileImage}
        src={`/media/user/${n.image}`}
        alt={`profile-image-${n.sender_username}`}
      />
      <div className={styles.messageContent}>
        <p className={styles.sender}>
          {n.sender_username} <strong>sent a message:</strong>
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