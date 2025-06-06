export const GlobalState = (() => {
    const persistKeys = ['isAuthenticated', 'id', 'username', 'name', 'email', 'image', 'created_at','theme', 'activeChatFriendId'];

    const state = {
        isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
        id: localStorage.getItem('id') || null,
        username: localStorage.getItem('username') || null,
        name: localStorage.getItem('name') || null,
        email: localStorage.getItem('email') || null,
        image: localStorage.getItem('image') || null,
        created_at: localStorage.getItem('created_at') || null,
        notifications: [],
        friends: [],
        active_friends: [],
        theme: localStorage.getItem('theme') || 'dark',
    };

    const listeners = {};
    let hasFetched = false;
    let socket = null;

    async function init() {
        loadPersistedState();
        initSocket();
        await fetchProfileInfoOnce();
        await fetchFriendsList();
    }
    function setActiveChatFriendId(id) {
        GlobalState.set('activeChatFriendId', id);
      }

    function on(key, callback) {
        if (!listeners[key]) listeners[key] = [];
        listeners[key].push(callback);
    }

    function off(key, callback) {
        if (!listeners[key]) return;
        listeners[key] = listeners[key].filter(cb => cb !== callback);
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

    function setMemoryOnly(key, value) {
        state[key] = value;
        if (listeners[key]) {
            listeners[key].forEach(cb => cb(value));
        }
    }

    function persist(key, value) {
        localStorage.setItem(key, value);
    }

    function setPersistent(key, value) {
        setMemoryOnly(key, value);
        if (persistKeys.includes(key)) {
            persist(key, value);
        }
    }

    function loadPersistedState() {
        persistKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                // Convert boolean strings back to booleans
                if (key === 'isAuthenticated') {
                    state[key] = value === 'true';
                } else {
                    state[key] = value;
                }
            }
        });
    }

    function updateNotifications(newNotifications) {
        state.notifications.push(...newNotifications);
        if (listeners['notifications']) {
            listeners['notifications'].forEach(cb => cb([...state.notifications]));
        }
    }

    function addNotification(notification) {
        const exists = state.notifications.some(n => n.id === notification.id);
        if (!exists) {
            state.notifications.push(notification);
            if (listeners['notifications']) {
                listeners['notifications'].forEach(cb => cb([...state.notifications]));
            }
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
        window.location.href = "/login";
    }

    async function deleteUserAccount() {
        try {
            await fetch('/api/user/delete', {
                method: "DELETE",
                credentials: "include",
            })
        } catch(e) {
            console.error("Error al eliminar la cuenta del usuario:",e);
        }

        GlobalState.clear();
        window.location.href = "/login";
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

                setPersistent('isAuthenticated', true);
                setPersistent('id', data.data.id);
                setPersistent('username', data.data.username);
                setPersistent('name', data.data.name);
                setPersistent('email', data.data.email);
                setPersistent('image', data.data.image);
                setPersistent('created_at', data.data.created_at);

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
                //console.log("Lista de amigos cargada:", GlobalState.get('friends'));
            })
            .catch(e => {
                console.error("Error al cargar la lista de amigos:", e);
            })
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
                console.log("Mensaje from /ws:", msg);
                if (msg.type_msg === 'FR') {
                    addNotification(msg);
                }

                if (msg.type_msg == 'active_friends') {
                    set('active_friends', msg.friends);
                    console.log("Active friends updated:", msg.friends);
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
        on, off, set, get,
        fetchProfileInfo, fetchProfileInfoOnce,
        clear, logout,
        updateNotifications, addNotification, clearNotifications, removeNotification, fetchFriendsList, init, initSocket, loadPersistedState, deleteUserAccount, setActiveChatFriendId
    };
})();