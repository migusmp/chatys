import type { ReactionCount } from "../types/chat_message";
import styles from "./MessageReactions.module.css";

type Props = {
    messageId: number;
    reactions: ReactionCount[];
    currentUserId?: number;
    onToggle: (messageId: number, emoji: string) => void;
    /** When true the reaction pills area is visible (message is hovered/active). */
    visible: boolean;
};

/**
 * Renders the reaction pills for a message.
 * The "+" picker trigger has been removed — reactions are added via the context menu.
 */
export default function MessageReactions({
    messageId,
    reactions,
    currentUserId: _currentUserId,
    onToggle,
    visible: _visible,
}: Props) {
    const handlePillClick = (emoji: string) => {
        onToggle(messageId, emoji);
    };

    // Build tooltip text from user list
    const pillTitle = (reaction: ReactionCount) =>
        reaction.users.length > 0 ? reaction.users.join(", ") : reaction.emoji;

    return (
        <div className={styles.wrapper}>
            {/* Existing reaction pills */}
            {reactions.map((reaction) => (
                <button
                    key={reaction.emoji}
                    type="button"
                    className={`${styles.pill} ${reaction.reacted_by_me ? styles.pillActive : ""}`}
                    onClick={() => handlePillClick(reaction.emoji)}
                    title={pillTitle(reaction)}
                    aria-label={`${reaction.emoji} ${reaction.count}`}
                    aria-pressed={reaction.reacted_by_me}
                >
                    <span>{reaction.emoji}</span>
                    <span className={styles.count}>{reaction.count}</span>
                </button>
            ))}
        </div>
    );
}
