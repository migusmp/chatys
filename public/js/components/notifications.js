import { GlobalState } from "../state.js";

let notificationMenu;
let wrapper;

function toggleMenu() {
  if (notificationMenu) {
    notificationMenu.classList.toggle('show');
  }
}

function outsideClickListener(e) {
  if (wrapper && !wrapper.contains(e.target)) {
    notificationMenu?.classList.remove('show');
  }
}

function renderNotifications(notifications) {
  const notificationCount = document.getElementById('notificationCount');
  const notificationList = document.getElementById('notificationList');
  const noNotifications = document.getElementById('noNotifications');

  if (!notificationCount || !notificationList || !noNotifications) {
    console.warn("Elementos del DOM no encontrados");
    return;
  }

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
      const li = document.createElement('li');
      li.classList.add('notification-item');

      const messageSpan = document.createElement('span');
      messageSpan.textContent = notif.message;
      li.appendChild(messageSpan);

      if (notif.type_msg === 'FR') {
        const actions = document.createElement('div');
        actions.classList.add('notification-actions');

        const acceptBtn = document.createElement('button');
        acceptBtn.innerHTML = '<i class="fas fa-check"></i>';
        acceptBtn.classList.add('btn-accept');
        acceptBtn.title = "Aceptar solicitud";
        acceptBtn.onclick = async () => {
          try {
            const res = await fetch(`/api/friend/accept/${notif.sender_id}`, { method: 'POST', credentials: 'include' });
            if (res.ok) {
              li.remove();
              GlobalState.removeNotification(notif);
              if (notificationList.children.length === 0) {
                notificationCount.style.display = 'none';
                noNotifications.style.display = 'block';
                notificationList.classList.add('hidden');
              }
            }
          } catch (e) { console.error(e); }
        };

        const rejectBtn = document.createElement('button');
        rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
        rejectBtn.classList.add('btn-reject');
        rejectBtn.title = "Rechazar solicitud";
        rejectBtn.onclick = async () => {
          if (!notif.id) {
            console.error('notif.id está undefined');
            return;
          }
          try {
            const res = await fetch(`/api/friend/reject/${notif.id}`, { method: 'POST', credentials: 'include' });
            if (res.ok) {
              li.remove();
              GlobalState.removeNotification(notif);
              if (notificationList.children.length === 0) {
                notificationCount.style.display = 'none';
                noNotifications.style.display = 'block';
                notificationList.classList.add('hidden');
              }
            }
          } catch (e) { console.error(e); }
        };

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
        li.appendChild(actions);
      }

      notificationList.appendChild(li);
    }
  }
}

export function initNotifications() {
  // Ahora sí: se accede al DOM después de que ya fue cargado
  notificationMenu = document.getElementById('notificationMenu');
  wrapper = document.querySelector('.notification-wrapper');

  if (!notificationMenu || !wrapper) {
    console.warn("⚠️ notificationMenu o wrapper no encontrados");
    return;
  }

  wrapper.addEventListener('click', toggleMenu);
  document.addEventListener('click', outsideClickListener);

  console.log("NOTIFICACIONES A RENDERIZAR:", GlobalState.get('notifications'));
  GlobalState.on('notifications', renderNotifications);
  renderNotifications(GlobalState.get('notifications'));
}

export function destroyNotifications() {
  if (wrapper) {
    wrapper.removeEventListener('click', toggleMenu);
  }
  document.removeEventListener('click', outsideClickListener);
  GlobalState.off('notifications', renderNotifications);
}
