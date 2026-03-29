import { useUserProfileContext } from "../../../../../context/UserContext";
import type { FullConversation } from "../../../../../types/user";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomMobile({ conversationData }: Props) {
    const { user } = useUserProfileContext();

    const otherParticipant = conversationData.conversation.participants.find(
        (p) => p.id !== user?.id
    );

    return (
        <div>
            <h1 style={{ color: "white" }}>
                Chat con: {otherParticipant?.username}
            </h1>
            <img
                src={`/media/user/${otherParticipant?.image}`}
                alt={otherParticipant?.username}
                style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    objectFit: "cover",
                }}
            />
            <p style={{ color: "#aaa" }}>
                Esta es la versión de movil del chat.
            </p>
        </div>
    );
}
