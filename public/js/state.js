export const GlobalState = (() => {
    const persistKeys = ['isAuthenticated', 'id', 'username', 'name', 'email', 'image', 'theme'];

    const state = {
        isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
        id: localStorage.getItem('id') || null,
        username: localStorage.getItem('username') || null,
        name: localStorage.getItem('name') || null,
        email: localStorage.getItem('email') || null,
        image: localStorage.getItem('image') || null,
        theme: localStorage.getItem('theme') || 'dark',
    };

    const listeners = {};
    let hasFetched = false;

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

    function clear() {
        for (const key of persistKeys) {
            state[key] = key === 'theme' ? 'dark' : null;
            localStorage.removeItem(key);
        }
        state.isAuthenticated = false;
        localStorage.setItem('isAuthenticated', 'false');
        hasFetched = false;
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
                clear(); // limpia si hubo error
            });
    }

    async function fetchProfileInfoOnce() {
        console.log("Intentando cargar perfil una vez...");
        if (hasFetched || get('isAuthenticated')) return;
        await fetchProfileInfo();
    }

    return { on, set, get, fetchProfileInfo, fetchProfileInfoOnce, clear };
})();