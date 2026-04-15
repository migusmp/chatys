import { useState } from "react";
import type { ReactionCount } from "../types/chat_message";
import styles from "./MessageReactions.module.css";

// Curated set of quick reactions — no external library needed.
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

type Props = {
    messageId: number;
    reactions: ReactionCount[];
    currentUserId?: number;
    onToggle: (messageId: number, emoji: string) => void;
    /** When true the trigger and picker are visible (message is hovered/active). */
    visible: boolean;
};

/**
 * Renders the reaction pills for a message and an inline emoji picker.
 * Completely uncontrolled regarding open/close state — the parent drives visibility
 * via the `visible` prop so we don't need nested hover logic here.
 */
export default function MessageReactions({
    messageId,
    reactions,
    currentUserId: _currentUserId,
    onToggle,
    visible,
}: Props) {
    const [pickerOpen, setPickerOpen] = useState(false);

    const handlePillClick = (emoji: string) => {
        onToggle(messageId, emoji);
    };

    const handleEmojiPick = (emoji: string) => {
        onToggle(messageId, emoji);
        setPickerOpen(false);
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

            {/* Picker trigger — only shown when parent signals hover */}
            {visible && (
                pickerOpen ? (
                    <div className={styles.picker} role="toolbar" aria-label="Reacciones rápidas">
                        {QUICK_EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className={styles.emojiBtn}
                                onClick={() => handleEmojiPick(emoji)}
                                aria-label={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                ) : (
                    <button
                        type="button"
                        className={styles.pickerTrigger}
                        onClick={() => setPickerOpen(true)}
                        aria-label="Añadir reacción"
                        title="Añadir reacción"
                    >
                        <span>+</span>
                    </button>
                )
            )}
        </div>
    );
}
