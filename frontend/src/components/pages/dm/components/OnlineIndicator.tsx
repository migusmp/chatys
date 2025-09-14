import { useUserContext } from "../../../../context/UserContext";

type Props = { userId: number, isHeader: boolean };

export function OnlineIndicator({ userId, isHeader }: Props) {
    const { checkUserIsOnline } = useUserContext();
    const isOnline = checkUserIsOnline(userId);

    return (
        <span
            style={{
                position: "absolute",
                bottom: "0",
                right: "0",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#0f6" : "#888",
                border: "2px solid rgb(0, 0, 0)",
                transition: !isHeader ? "background-color 0.2s ease-in-out": "none",
            }}
        />
    );
}