import type { DmNotification } from "../../../../../interfaces/notifications";
import type { Conversations, Participants } from "../../../../../types/user";

function buildParticipantFromNotification(notification: DmNotification): Participants {
    if (notification.type_msg === "NEW_DM_MESSAGE") {
        return {
            id: notification.from_user,
            username: notification.from_user_username,
            image: notification.from_user_image,
        };
    }

    return {
        id: notification.sender_id,
        username: notification.sender_username,
        image: notification.image,
    };
}

function buildConversationFromNotification(notification: DmNotification): Conversations {
    const lastMessageUserId =
        notification.type_msg === "NEW_DM_MESSAGE"
            ? notification.from_user
            : notification.sender_id;

    return {
        conversation_id: notification.conversation_id,
        is_group: false,
        updated_at: notification.created_at,
        last_message: notification.content,
        last_message_user_id: lastMessageUserId,
        participants: [buildParticipantFromNotification(notification)],
    };
}

export function mergeDmsWithRealtimeMessages(
    dms: Conversations[],
    notifications: DmNotification[],
): Conversations[] {
    const latestNotificationByConversation = new Map<number, DmNotification>();

    for (const notification of notifications) {
        const current = latestNotificationByConversation.get(notification.conversation_id);

        if (
            !current ||
            new Date(notification.created_at).getTime() >=
                new Date(current.created_at).getTime()
        ) {
            latestNotificationByConversation.set(notification.conversation_id, notification);
        }
    }

    const merged = dms.map((dm) => {
        const notification = latestNotificationByConversation.get(dm.conversation_id);

        if (!notification) {
            return dm;
        }

        return {
            ...dm,
            last_message: notification.content,
            last_message_user_id:
                notification.type_msg === "NEW_DM_MESSAGE"
                    ? notification.from_user
                    : notification.sender_id,
            updated_at: notification.created_at,
        };
    });

    for (const [conversationId, notification] of latestNotificationByConversation) {
        const alreadyExists = merged.some(
            (dm) => dm.conversation_id === conversationId,
        );

        if (!alreadyExists) {
            merged.push(buildConversationFromNotification(notification));
        }
    }

    return merged.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
}
