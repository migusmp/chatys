import styled from "styled-components";

const StyledWrapper = styled.div`
    .card {
        background-color: #060606;
        border: 1px solid #1a1a1a;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: border-color 0.15s;
        cursor: pointer;
    }

    .card:hover {
        border-color: #333;
    }

    .card-top {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .card-avatar {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background-color: #111;
        border: 1px solid #222;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
        overflow: hidden;
    }

    .card-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 10px;
    }

    .card-avatar-letter {
        font-size: 16px;
        font-weight: 700;
        color: #ccc;
        text-transform: uppercase;
        user-select: none;
    }

    .card-info {
        flex: 1;
        min-width: 0;
    }

    .card-name {
        font-size: 13px;
        font-weight: 600;
        color: #ddd;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0;
    }

    .card-members {
        font-size: 11px;
        color: #0f6;
        margin: 2px 0 0;
    }

    .card-description {
        font-size: 12px;
        color: #444;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0;
        flex: 1;
    }

    .card-btn {
        width: 100%;
        padding: 7px;
        border-radius: 8px;
        background-color: #0f6;
        color: #000;
        font-size: 12px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: background-color 0.15s, opacity 0.15s;
    }

    .card-btn:hover:not(:disabled) {
        background-color: #0d5;
    }

    .card-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .card-joined {
        width: 100%;
        padding: 7px;
        border-radius: 8px;
        background-color: transparent;
        color: #0f6;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid rgba(0, 255, 102, 0.3);
        cursor: default;
        text-align: center;
    }

    .card-enter {
        width: 100%;
        padding: 7px;
        border-radius: 8px;
        background-color: transparent;
        color: #0f6;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid rgba(0, 255, 102, 0.25);
        cursor: pointer;
        transition: background-color 0.15s, border-color 0.15s;
        text-align: center;
    }

    .card-enter:hover {
        background-color: rgba(0, 255, 102, 0.06);
        border-color: rgba(0, 255, 102, 0.5);
    }

    .card-friends {
        font-size: 11px;
        color: #556;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

interface ServerCardProps {
    name: string;
    memberCount: number;
    image?: string;
    description?: string;
    friendsInServer?: string[];
    onClick?: () => void;
    buttonText?: string;
    onButtonClick?: (e: React.MouseEvent) => void;
    buttonDisabled?: boolean;
    isJoined?: boolean;
    isEnter?: boolean;
}

export default function ServerCard({
    name,
    memberCount,
    image,
    description,
    friendsInServer,
    onClick,
    buttonText,
    onButtonClick,
    buttonDisabled,
    isJoined,
    isEnter,
}: ServerCardProps) {
    return (
        <StyledWrapper>
            <div className="card" onClick={onClick}>
                <div className="card-top">
                    <div className="card-avatar">
                        {image ? (
                            <img src={image} alt={name} />
                        ) : (
                            <span className="card-avatar-letter">{name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="card-info">
                        <p className="card-name">{name}</p>
                        <p className="card-members">
                            {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
                        </p>
                    </div>
                </div>
                {description && <p className="card-description">{description}</p>}
                {friendsInServer && friendsInServer.length > 0 && (
                    <p className="card-friends">
                        👥 {friendsInServer.slice(0, 3).join(", ")}
                        {friendsInServer.length > 3 && ` y ${friendsInServer.length - 3} más`}
                    </p>
                )}
                {isEnter && <div className="card-enter">Entrar →</div>}
                {isJoined && !isEnter && <div className="card-joined">Unido ✓</div>}
                {buttonText && !isJoined && !isEnter && (
                    <button
                        className="card-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onButtonClick?.(e);
                        }}
                        disabled={buttonDisabled}
                    >
                        {buttonText}
                    </button>
                )}
            </div>
        </StyledWrapper>
    );
}