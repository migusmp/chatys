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

export async function updateUserData(data) {
  const encoded = toUrlEncoded(data);
  try {
      const res = await fetch('/api/user/update', {
          method: "PUT",
          headers: {
              "Content-Type": "application/x-www-form-urlencoded"
          },
          credentials: "include",
          body: encoded
      });

      const json = await res.json();
      console.log("UPDATE RESPONSE:", json);
      return json;
  } catch (e) {
      console.error("Error fetching new update data:", e);
      throw e;
  }
}

export function getChangedFields(updated, current) {
    const changed = {};
    for (const key in updated) {
      if (updated[key] !== current[key]) {
        changed[key] = updated[key];
      }
    }
    return changed;
  }

export function toUrlEncoded(data) {
    const params = new URLSearchParams();
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        params.append(key, data[key]);
      }
    }
    return params.toString();
  }

export async function obtainMessagesFromConversation(from_user_id, to_user_id) {
  try {
    const res = await fetch(`/api/chat/conversations/${from_user_id}/${to_user_id}`, {
      method: "GET",
      credentials: "include"
    });

    const json = await res.json();
    console.log("Messages from conversation:", json);
    return json;
  } catch(e) {
    console.error("Error al obtener los mensajes del chat entre el usuario " + from_user_id + " y " + to_user_id);
  }
}
// // Function to fetch a user friends list}
// export async function startApp() {
//     // 🔁 Cargar perfil (si es necesario)
//     await GlobalState.fetchProfileInfoOnce();

//     // ✅ Cargar amigos y guardar en GlobalState
//     await GlobalState.fetchFriendsList();
// }