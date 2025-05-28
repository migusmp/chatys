import { GlobalState } from "./state.js";

const notificationCount = document.getElementById('notificationCount');
const notificationMenu = document.getElementById('notificationMenu');
const notificationList = document.getElementById('notificationList');
const noNotifications = document.getElementById('noNotifications');

// Mostrar el menú al hacer clic
document.querySelector('.notification-wrapper').addEventListener('click', () => {
    notificationMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notification-wrapper');
    if (!wrapper.contains(e.target)) {
        notificationMenu.classList.remove('show');
    }
});

// Escuchar cambios
GlobalState.on('notifications', notifications => {
    if (notifications.length === 0) {
        notificationCount.style.display = 'none';
        noNotifications.style.display = 'block';
        notificationList.classList.add('hidden');
        notificationList.innerHTML = '';
    } else {
        notificationCount.style.display = 'inline';
        notificationCount.textContent = notifications.length;
        noNotifications.style.display = 'none';
        notificationList.classList.remove('hidden');
        notificationList.innerHTML = '';
        for (const notif of notifications) {
            console.log("Notification:", notif);
            const li = document.createElement('li');
            li.classList.add('notification-item');
        
            // Texto del mensaje
            const messageSpan = document.createElement('span');
            messageSpan.textContent = notif.message;
            li.appendChild(messageSpan);
        
            if (notif.type_msg === 'FR') {
                const actions = document.createElement('div');
                actions.classList.add('notification-actions');
        
                // Botón aceptar (tick verde)
                const acceptBtn = document.createElement('button');
                acceptBtn.innerHTML = '<i class="fas fa-check"></i>';
                acceptBtn.classList.add('btn-accept');
                acceptBtn.title = "Aceptar solicitud";
                acceptBtn.onclick = () => {
                    console.log("Solicitud aceptada:", notif);
                    // Aquí deberías hacer una llamada al backend
                };
        
                // Botón rechazar (cruz roja)
                const rejectBtn = document.createElement('button');
                rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
                rejectBtn.classList.add('btn-reject');
                rejectBtn.title = "Rechazar solicitud";
                rejectBtn.onclick = () => {
                    console.log("Solicitud rechazada:", notif);
                    // Aquí deberías hacer una llamada al backend
                };
        
                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);
                li.appendChild(actions);
            }
        
            notificationList.appendChild(li);
        }
    }
});
