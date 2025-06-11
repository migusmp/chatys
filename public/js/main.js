import { connectToFriend } from "../dm-page/js/socketManager.js";
import { initRouter } from "./router.js";
import { GlobalState } from "./state.js"

document.addEventListener('DOMContentLoaded', function() {

    GlobalState.init().then(() => {
        //console.log("GlobalState initialized successfully");
    });

    GlobalState.on('active_friends', (newActiveFriends) => {
        console.log("Amigos activos actualizados:", newActiveFriends);
    
        newActiveFriends.forEach(friend => {
            const friendId = friend.id;
    
            // Evitar conectar varias veces al mismo amigo: puedes usar un objeto externo para controlar esto
            if (!window.connectedFriendSockets) {
                window.connectedFriendSockets = {};
            }
    
            if (!window.connectedFriendSockets[friendId]) {
                window.connectedFriendSockets[friendId] = GlobalState.connectToFriend(friendId, (msg) => {
                    console.log(`📨 Mensaje de ${friend.username}:`, msg);
                    GlobalState.addMessageNotification(msg);
                });
            }
        });
    });

    const container = document.getElementById('app');
    initRouter(container);
})