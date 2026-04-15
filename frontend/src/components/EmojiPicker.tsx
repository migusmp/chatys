import styles from "./EmojiPicker.module.css";

const EMOJI_CATEGORIES = [
    {
        label: "Caritas",
        emojis: ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "😅", "😭", "😤", "🥲", "😜", "🫡", "🤯", "😱", "🥳", "😏", "😇", "🤫", "😶"],
    },
    {
        label: "Gestos",
        emojis: ["👍", "👎", "❤️", "🙌", "👏", "🤝", "🫂", "💪", "🤌", "🤙", "✌️", "🤞", "🫶", "🙏", "👋", "💅", "☝️", "🫵"],
    },
    {
        label: "Naturaleza",
        emojis: ["🌈", "☀️", "🌙", "⭐", "❄️", "🔥", "💧", "🌊", "⚡", "🌸", "🌿", "🍀", "🌻", "🦋", "🐶", "🐱", "🐸", "🦁"],
    },
    {
        label: "Comida",
        emojis: ["🍕", "🍔", "🍟", "🌮", "🍜", "🍣", "🍩", "🎂", "🍺", "🧃", "🍓", "🫐", "🍌", "🍑", "🥑", "🌶️", "🧀", "🥞"],
    },
    {
        label: "Objetos",
        emojis: ["💯", "🎉", "🎊", "🎮", "🎵", "📱", "💻", "🔑", "💡", "🚀", "💎", "🔮", "🎯", "🏆", "🎁", "📸", "🎤", "🎧"],
    },
    {
        label: "Símbolos",
        emojis: ["✅", "❌", "⚠️", "💥", "✨", "💫", "❓", "‼️", "💤", "🔞", "🆒", "🆕", "🆓", "🔴", "🟢", "🔵", "⬛", "🏳️"],
    },
];

type Props = {
    onSelect: (emoji: string) => void;
};

export default function EmojiPicker({ onSelect }: Props) {
    return (
        <div className={styles.picker}>
            {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className={styles.category}>
                    <span className={styles.categoryLabel}>{cat.label}</span>
                    <div className={styles.grid}>
                        {cat.emojis.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className={styles.emojiBtn}
                                onClick={() => onSelect(emoji)}
                                aria-label={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
