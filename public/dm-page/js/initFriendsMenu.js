import { GlobalState } from "../../js/state.js";
import { loadChat } from "./dm.js";

export function initFriendsMenuDm() {
    const friendsSection = document.getElementById("sidebar");
    let friendsList = friendsSection.querySelector("ul");
    
    if (!friendsList) {
        friendsList = document.createElement("ul");
        friendsSection.appendChild(friendsList);
    }

    friendsList.className = "friend-list";

    function renderFriends() {
        const friends = GlobalState.get('friends') || [];
        const activeFriends = GlobalState.get('active_friends') || [];

        friendsList.innerHTML = "";

        if (friends.length === 0) {
            const li = document.createElement("li");
            li.className = "friend-empty";
            li.textContent = "Aún no tienes amigos";
            friendsList.appendChild(li);
            return;
        }

        const sortedFriends = [...friends].sort((a, b) => {
            const aActive = activeFriends.includes(a.id);
            const bActive = activeFriends.includes(b.id);
            return (aActive === bActive) ? 0 : aActive ? -1 : 1;
        });

        for (const friend of sortedFriends) {
            const isActive = activeFriends.includes(friend.id);

            const li = document.createElement("li");
            li.className = "friend-item";

            const friendData = {
                ...friend,
                isActive
            };

            li.addEventListener("click", () => {
                console.log("FRIEND: ", friend);
                loadChat(friendData);
            });

            const imgWrapper = document.createElement("div");
            imgWrapper.className = "friend-avatar-wrapper";

            const img = document.createElement("img");
            img.className = "friend-avatar";
            img.src = `/media/user/${friend.image}`;
            img.alt = `${friend.username}`;
            img.width = 32;
            img.height = 32;

            const statusDot = document.createElement("div");
            statusDot.className = "friend-status";
            if (isActive) statusDot.classList.add("online");

            imgWrapper.appendChild(img);
            imgWrapper.appendChild(statusDot);

            const span = document.createElement("span");
            span.className = "friend-username";
            span.textContent = friend.username;

            li.appendChild(imgWrapper);
            li.appendChild(span);

            friendsList.appendChild(li);
        }
    }

    renderFriends();

    GlobalState.on('active_friends', renderFriends);
    GlobalState.on('friends', renderFriends);
}