import { GlobalState } from './state.js'


export function initPage() {
    console.log("CARGANDO FRIEND PAGEEE");
    const container = document.getElementById('friends-container');
    container.innerHTML = ''; // Limpia el contenido inicial

    const friends = GlobalState.get('friends');
    console.log("Amigos que llegan: ",friends);
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
}
