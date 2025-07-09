import { useUserContext } from "../../../../context/UserContext";

type Props = { userId: number };

export function OnlineIndicator({ userId }: Props) {
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
                backgroundColor: isOnline ? "#4caf50" : "#888",
                border: "2px solid #1e1e2f",
                transition: "background-color 0.2s ease-in-out",
            }}
        />
    );
}