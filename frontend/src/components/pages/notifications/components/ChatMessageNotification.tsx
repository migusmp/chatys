import type { ChatMessageNotification } from "../../../../interfaces/notifications";


interface Props {
  n: ChatMessageNotification;
}

export default function ChatMessageNotification({ n }: Props) {
    return (
        <>
            <img style={{ width: '40px', borderRadius: '50%'}} src={`/media/user/${n.image}`} alt={`profile-image-${n.sender_username}`}/>
            <p><strong>{n.sender_username}</strong> sent a message:</p>
            <p style={{ fontStyle: 'italic' }}>{n.content}</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {new Date(n.created_at).toLocaleString()}
            </p>
        </>
    )
}