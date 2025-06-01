// profileMenu.js
import { GlobalState } from '../state.js';

export function initProfileMenu() {

    const profileIcon = document.querySelector('.profile-icon');
    const username = document.querySelector('.username');
    const profileMenu = document.getElementById('profileMenu');
    const logoutBtn = document.querySelector('.logout');

    if (!profileIcon || !username || !profileMenu || !logoutBtn) {
        console.warn("Elementos del menú de perfil no encontrados.");
        return;
    }

    function toggleMenu() {
        profileMenu.classList.toggle('show');
    }

    profileIcon.addEventListener('click', toggleMenu);
    username.addEventListener('click', toggleMenu);

    // Cierra el menú si se hace clic fuera
    document.addEventListener('click', (e) => {
        if (!profileMenu.contains(e.target) && e.target !== profileIcon && e.target !== username) {
            profileMenu.classList.remove('show');
        }
    });

    logoutBtn.addEventListener('click', () => {
        GlobalState.logout();
    });
}
