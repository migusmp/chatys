type Props = {
    isRead: boolean;
};

export function ReadReceipt({ isRead }: Props) {
    if (isRead) {
        return (
            <span
                aria-label="Leído"
                style={{ fontSize: "0.7rem", color: "#0f6", letterSpacing: "-2px", flexShrink: 0 }}
            >
                ✓✓
            </span>
        );
    }

    return (
        <span
            aria-label="Enviado"
            style={{ fontSize: "0.7rem", color: "#888", flexShrink: 0 }}
        >
            ✓
        </span>
    );
}
