export const GlobalState = (() => {
    const persistKeys = ['isAuthenticated', 'id', 'username', 'name', 'email', 'image', 'theme'];

    const state = {
        isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
        id: localStorage.getItem('id') || null,
        username: localStorage.getItem('username') || null,
        name: localStorage.getItem('name') || null,
        email: localStorage.getItem('email') || null,
        image: localStorage.getItem('image') || null,
        notifications: [],
        friends: [],
        theme: localStorage.getItem('theme') || 'dark',
    };

    const listeners = {};
    let hasFetched = false;
    let socket = null;

    async function init() {
        await fetchProfileInfoOnce();
        await fetchFriendsList();
    }

    function on(key, callback) {
        if (!listeners[key]) listeners[key] = [];
        listeners[key].push(callback);
    }

    function set(key, value) {
        state[key] = value;
        if (persistKeys.includes(key)) {
            localStorage.setItem(key, value);
        }
        if (listeners[key]) {
            listeners[key].forEach(cb => cb(value));
        }
    }

    function get(key) {
        return state[key];
    }

    function updateNotifications(newNotifications) {
        state.notifications.push(...newNotifications);
        if (listeners['notifications']) {
            listeners['notifications'].forEach(cb => cb([...state.notifications]));
        }
    }
    
    function addNotification(notification) {
        state.notifications.push(notification);
        if (listeners['notifications']) {
            listeners['notifications'].forEach(cb => cb([...state.notifications]));
        }
    }
    
    function clearNotifications() {
        state.notifications = [];
        if (listeners['notifications']) {
            listeners['notifications'].forEach(cb => cb([]));
        }
    }

    function removeNotification(notification) {
        const index = state.notifications.findIndex(n => n.id === notification.id);
        if (index !== -1) {
            state.notifications.splice(index, 1);
            if (listeners['notifications']) {
                listeners['notifications'].forEach(cb => cb([...state.notifications]));
            }
        }
    }

    function clear() {
        for (const key of persistKeys) {
            state[key] = key === 'theme' ? 'dark' : null;
            localStorage.removeItem(key);
        }
        state.isAuthenticated = false;
        localStorage.setItem('isAuthenticated', 'false');
        hasFetched = false;
    }

    async function logout() {
        try {
            await fetch('/api/user/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            console.error("Error al cerrar sesión en el servidor:", err);
        }
    
        GlobalState.clear();
        location.reload();
    }

    async function fetchProfileInfo() {
        return fetch('/api/user/profile', {
            method: 'GET',
            credentials: 'include',
        })
            .then(res => res.json())
            .then(data => {
                console.log("Perfil cargado:", data);
                if (!data?.data) throw new Error('Perfil inválido');
                set('isAuthenticated', true);
                set('id', data.data.id);
                set('username', data.data.username);
                set('name', data.data.name);
                set('email', data.data.email);
                set('image', data.data.image);
                hasFetched = true;
            })
            .catch(err => {
                console.error("No se pudo cargar perfil:", err);
                clear();
            });
    }

    async function fetchProfileInfoOnce() {
        if (hasFetched || get('isAuthenticated')) return;
        await fetchProfileInfo();
    }

    async function fetchFriendsList() {
        await fetch('/api/user/get-friends', {
            method: "GET",
            credentials: "include"
        })
        .then(res => res.json())
        .then(data => {
            set('friends', data.data);
            console.log("Lista de amigos cargada:", GlobalState.get('friends'));
        })
        .catch(e => {
            console.error("Error al cargar la lista de amigos:", e);
        })
    }

    async function init() {
        initSocket();
        await fetchProfileInfoOnce();
        await fetchFriendsList();
    }

    function initSocket() {
        if (socket) return; // evitar doble conexión

        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        socket = new WebSocket(`${protocol}://${location.host}/ws`);

        socket.onopen = () => {
            console.log('🔌 WebSocket conectado');
        };

        socket.onmessage = (event) => {
            console.log('📨 Mensaje del servidor:', event.data);
            try {
                const msg = JSON.parse(event.data);
                console.log("Mensaje from /ws:",msg);
                if (msg.type_msg === 'FR') {
                    addNotification(msg);
                }
            } catch (e) {
                console.error('⚠️ Error al parsear JSON:', e);
            }
        };

        socket.onerror = (err) => {
            console.error('❌ WebSocket error:', err);
        };

        socket.onclose = () => {
            console.warn('🔌 WebSocket desconectado');
            socket = null;
        };
    }

    return {
        on, set, get,
        fetchProfileInfo, fetchProfileInfoOnce,
        clear, logout,
        updateNotifications, addNotification, clearNotifications, removeNotification, fetchFriendsList, init, initSocket
    };
})();