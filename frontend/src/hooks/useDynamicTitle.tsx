import { useEffect } from "react";

export default function useDynamicTitle(unreadCount: number) {
    useEffect(() => {
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) Chatys`;
        } else {
            document.title = "Chatys";
        }
    }, [unreadCount]);
}

