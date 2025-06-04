import { WSChat } from "./api/ws_chat.js";
import { renderActiveRooms, renderChatStats } from "./components/chat.js";
import { initProfileMenu } from "./components/profileMenu.js";
import { destroyNotifications, initNotifications } from "./components/notifications.js";
import { GlobalState } from "./state.js";
import { goto } from "./router.js";
import { initFriendsMenu } from "./components/friendsMenu.js";

let generalStatsSocket = null;

export function initPage() {
  document.querySelector('.username').textContent = GlobalState.get('username');
  const userImg = document.querySelector('.user-image');
  const img = document.createElement('img');
  img.src = `/media/user/${GlobalState.get('image')}`; // cambia esta ruta
  img.alt = `image-${GlobalState.get('username')}`;
  img.width = 32;
  img.height = 32;
  img.className = "profile-icon";
  img.style.borderRadius = '50%';

  userImg.appendChild(img);
  document.querySelector(".friends").addEventListener("click", () => {
    goto("/friends");
  })

  document.querySelector(".profile").addEventListener("click", () => {
    goto("/profile");
  })

  document.getElementById("dm-btn").addEventListener("click", () => {
    goto("/dm");
  })

  const roomInput = document.getElementById("roomNameInput");
  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    if (!roomInput.value.trim()) {
      alert("Por favor, ingresa un nombre de sala.");
      return;
    }
    goto(`/chats/${roomInput.value.trim()}`);
    roomInput.value = ""; // Limpiar el input después de unirse

  })
  // Crear la conexión y asignarla a la variable
  generalStatsSocket = WSChat.connectGeneralStats((stats) => {
    renderChatStats(stats);
    renderActiveRooms(stats.activeRooms);
  });
  GlobalState.initSocket();
  initNotifications();
  initProfileMenu();
  initFriendsMenu();
}

export function destroyPage() {
  if (generalStatsSocket) {
    generalStatsSocket.close();  // Cierra el WebSocket
    generalStatsSocket = null;
  }
  destroyNotifications();
}

