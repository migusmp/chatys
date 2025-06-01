// import { GlobalState } from "../state.js";

// Function to send a friend request
export async function sendFriendRequest(userId) {
    fetch(`/api/friend/add/${userId}`, {
        method: "POST",
        credentials: "include",
    }).catch(e => {
        console.error(e);
    })
}

// // Function to fetch a user friends list}
// export async function startApp() {
//     // 🔁 Cargar perfil (si es necesario)
//     await GlobalState.fetchProfileInfoOnce();

//     // ✅ Cargar amigos y guardar en GlobalState
//     await GlobalState.fetchFriendsList();
// }