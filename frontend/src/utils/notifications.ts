const NOTIFICATION_ICON = "/favicon.ico";
const MESSAGE_PREVIEW_MAX_LENGTH = 60;
const MESSAGE_PREVIEW_TRUNCATED_LENGTH = 57;

export function truncateMessage(text: string): string {
    if (!text) return "Envió una imagen 🖼️";
    return text.length > MESSAGE_PREVIEW_MAX_LENGTH
        ? text.slice(0, MESSAGE_PREVIEW_TRUNCATED_LENGTH) + "..."
        : text;
}

export function requestNotificationPermission(): void {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    Notification.requestPermission().catch(() => {
        // Permission request failed silently — user may have blocked it at the OS level
    });
}

export function showNotification(title: string, body: string, onClick?: () => void): void {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;

    const notification = new Notification(title, {
        body,
        icon: NOTIFICATION_ICON,
    });

    if (onClick) {
        notification.onclick = () => {
            window.focus();
            onClick();
            notification.close();
        };
    }
}
