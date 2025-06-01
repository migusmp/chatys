import { GlobalState } from './state.js'
const container = document.getElementById('friends-container');
  container.innerHTML = ''; // Limpia el contenido inicial

  const friends = GlobalState.get('friends');

  if (!friends || friends.length === 0) {
    container.innerHTML = '<p>No tienes amigos aún.</p>';
  }

  const ul = document.createElement('ul');

  friends.forEach(friend => {
    const li = document.createElement('li');

    if (friend.username && friend.username.length > 0) {
      const strong = document.createElement('strong');
      strong.textContent = friend.username;
      li.appendChild(strong);
    }

    const img = document.createElement('img');
    img.src = `/media/user/${friend.image}`;
    img.alt = `Imagen de ${friend.username}`;
    li.appendChild(img);

    ul.appendChild(li);
  });

  container.appendChild(ul);