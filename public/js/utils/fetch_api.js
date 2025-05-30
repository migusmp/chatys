
// Function to send a friend request
export async function sendFriendRequest(userId) {
    fetch(`/api/friend/add/${userId}`, {
        method: "POST",
        credentials: "include",
    }).catch(e => {
        console.error(e);
    })
}