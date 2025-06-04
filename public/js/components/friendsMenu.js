import { GlobalState } from "../state.js";

export function initFriendsMenu() {
    const friendsSection = document.getElementById("friendsSection");
    const friendsList = friendsSection.querySelector("ul");

    function renderFriends() {
        const friends = GlobalState.get('friends') || [];
        const activeFriends = GlobalState.get('active_friends') || [];
    
        friendsList.innerHTML = "";
    
        if (friends.length === 0) {
            const li = document.createElement("li");
            li.textContent = "Aún no tienes amigos";
            li.style.textAlign = "center";
            li.style.color = "#888";
            li.style.padding = "1rem";
            friendsList.appendChild(li);
            return;
        }
    
        // Ordenar: los conectados (activos) primero
        const sortedFriends = [...friends].sort((a, b) => {
            const aActive = activeFriends.includes(a.id);
            const bActive = activeFriends.includes(b.id);
            return (aActive === bActive) ? 0 : aActive ? -1 : 1;
        });
    
        for (const friend of sortedFriends) {
            const isActive = activeFriends.includes(friend.id);
    
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.gap = "0.75rem";
            li.style.position = "relative";
    
            const imgWrapper = document.createElement("div");
            imgWrapper.style.position = "relative";
            imgWrapper.style.width = "32px";
            imgWrapper.style.height = "32px";
    
            const img = document.createElement("img");
            img.src = `/media/user/${friend.image}`;
            img.alt = `${friend.username}`;
            img.width = 32;
            img.height = 32;
            img.style.borderRadius = "50%";
            img.style.display = "block";
    
            const statusDot = document.createElement("div");
            statusDot.style.position = "absolute";
            statusDot.style.right = "0";
            statusDot.style.bottom = "0";
            statusDot.style.width = "12px";
            statusDot.style.height = "12px";
            statusDot.style.borderRadius = "50%";
            statusDot.style.border = "2px solid var(--card-bg)";
            statusDot.style.backgroundColor = isActive ? "limegreen" : "#555";
    
            imgWrapper.appendChild(img);
            imgWrapper.appendChild(statusDot);
    
            const span = document.createElement("span");
            span.textContent = friend.username;
    
            li.appendChild(imgWrapper);
            li.appendChild(span);
            friendsList.appendChild(li);
        }
    }

    renderFriends();

    GlobalState.on('active_friends', () => {
        renderFriends();
    });

    GlobalState.on('friends', () => {
        renderFriends();
    });
}

