import { goto } from "../router.js";
import { GlobalState } from "../state.js";

let notificationMenu;
let wrapper;

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// Utilidad para ocultar notificaciones
function showNoNotifications(notificationCount, noNotifications, notificationList) {
  notificationCount.style.display = 'none';
  noNotifications.style.display = 'block';
  notificationList.classList.add('hidden');
  notificationList.innerHTML = '';
}

// Utilidad para mostrar lista de notificaciones
function showNotificationsList(notificationCount, noNotifications, notificationList, notifications) {
  notificationCount.style.display = 'inline';
  notificationCount.textContent = notifications.length;
  noNotifications.style.display = 'none';
  notificationList.classList.remove('hidden');
  notificationList.innerHTML = '';
}

// Crea los botones de aceptar/rechazar
function createFriendRequestActions(notif, li, notificationList, notificationCount, noNotifications) {
  const actions = document.createElement('div');
  actions.classList.add('notification-actions');

  const acceptBtn = document.createElement('button');
  acceptBtn.innerHTML = '<i class="fas fa-check"></i>';
  acceptBtn.classList.add('btn-accept');
  acceptBtn.title = "Aceptar solicitud";
  acceptBtn.onclick = () => handleFriendAccept(notif, li, notificationList, notificationCount, noNotifications);

  const rejectBtn = document.createElement('button');
  rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
  rejectBtn.classList.add('btn-reject');
  rejectBtn.title = "Rechazar solicitud";
  rejectBtn.onclick = () => handleFriendReject(notif, li, notificationList, notificationCount, noNotifications);

  actions.appendChild(acceptBtn);
  actions.appendChild(rejectBtn);

  return actions;
}

// Maneja aceptar solicitud
async function handleFriendAccept(notif, li, notificationList, notificationCount, noNotifications) {
  try {
    const res = await fetch(`/api/friend/accept/${notif.sender_id}`, {
      method: 'POST',
      credentials: 'include'
    });
    if (res.ok) {
      li.remove();
      GlobalState.removeNotification(notif);
      if (notificationList.children.length === 0) {
        showNoNotifications(notificationCount, noNotifications, notificationList);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// Maneja rechazar solicitud
async function handleFriendReject(notif, li, notificationList, notificationCount, noNotifications) {
  if (!notif.id) {
    console.error('notif.id está undefined');
    return;
  }

  try {
    const res = await fetch(`/api/friend/reject/${notif.id}`, {
      method: 'POST',
      credentials: 'include'
    });
    if (res.ok) {
      li.remove();
      GlobalState.removeNotification(notif);
      if (notificationList.children.length === 0) {
        showNoNotifications(notificationCount, noNotifications, notificationList);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function createNotificationItem(notif, notificationList, notificationCount, noNotifications) {
  const li = document.createElement('li');
  li.classList.add('notification-item', `notification-${notif.type_msg}`);

  if (notif.type_msg === 'chat_message') {
    const header = document.createElement('div');
    header.classList.add('notification-header');

    const sender = document.createElement('strong');
    sender.classList.add('notification-sender');
    sender.textContent = notif.sender_username;

    const timestamp = document.createElement('time');
    timestamp.classList.add('notification-timestamp');
    timestamp.dateTime = notif.created_at;
    timestamp.textContent = formatTimestamp(notif.created_at);

    const content = document.createElement('p');
    content.classList.add('notification-content');
    content.textContent = notif.content;

    header.appendChild(sender);
    header.appendChild(document.createTextNode(' · ')); // punto separador
    header.appendChild(content);

    

    li.appendChild(header);
    li.appendChild(timestamp);

    li.addEventListener("click", () => {
      goto(`/dm/${notif.sender_username}`);
    })

  } else {
    const message = document.createElement('p');
    message.classList.add('notification-message');
    message.textContent = notif.message;
    li.appendChild(message);

    if (notif.type_msg === 'FR') {
      const actions = createFriendRequestActions(notif, li, notificationList, notificationCount, noNotifications);
      actions.classList.add('notification-actions');
      li.appendChild(actions);
    }
  }

  notificationList.appendChild(li);
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
    showNoNotifications(notificationCount, noNotifications, notificationList);
  } else {
    showNotificationsList(notificationCount, noNotifications, notificationList, notifications);

    for (const notif of notifications) {
      console.log("NOTIFICACION A CREAR:", notif);
      createNotificationItem(notif, notificationList, notificationCount, noNotifications);
    }
  }

  updateDmBadge(notifications);
}

function updateDmBadge(notifications) {
  const dmBadge = document.getElementById("dmBadge");
  if (!dmBadge) return;

  const chatNotifs = notifications.filter(n => n.type_msg === 'chat_message');

  if (chatNotifs.length > 0) {
    dmBadge.textContent = chatNotifs.length;
    dmBadge.style.display = "flex";
  } else {
    dmBadge.style.display = "none";
  }
}

export function initNotifications() {
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
