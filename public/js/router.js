import { loadChatPage } from "./chat/chat.js";

let loadRouteFn = null;
export function goto(path) {
  if (loadRouteFn) loadRouteFn(path);
  else console.warn("Router not initialized yet");
}

export function initRouter(container) {
  const routes = {
    '/': { html: 'static/home.html', js: '/static/js/main.js', css: 'static/styles/index.css' },
    '/chats': { html: 'static/chats.html', js: '/static/js/chats.js', css: 'static/styles/chats.css' },
    '/chats/:roomId': { html: '/static/chat.html', js: '/static/js/chat/chat.js', css: '/static/styles/chat.css' },
    '/friends' : { html: '/static/friends.html', js: '/static/js/friends.js', css: '/static/styles/friends.css' }
  };


  const cacheJsModules = new Map();
  let activeModule = null;

  async function loadRoute(path, push = true) {
    let route = routes[path];
    let params = {};

    if (!route) {
      // Buscar coincidencia con rutas dinámicas
      for (const [pattern, config] of Object.entries(routes)) {
        const paramNames = [];
        const regexPattern = pattern.replace(/:([^/]+)/g, (_, key) => {
          paramNames.push(key);
          return '([^/]+)';
        });
        const regex = new RegExp(`^${regexPattern}$`);
        const match = path.match(regex);
        if (match) {
          route = config;
          paramNames.forEach((key, i) => {
            params[key] = decodeURIComponent(match[i + 1]);
          });
          break;
        }
      }
    }

    if (!route) {
      container.innerHTML = `
          <h2>404 - Page Not Found</h2>
          <p>La ruta "${path}" no existe.</p>
          <a href="/" data-link>Ir al inicio</a>
        `;
      return;
    }

    // Mostrar loading mientras carga
    container.innerHTML = `
  <div class="spinner"></div>
  <style>
    .spinner {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      z-index: 9999;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
`;

    // Limpia módulo JS anterior
    if (activeModule && activeModule.destroyPage) {
      activeModule.destroyPage();
      activeModule = null;
    }

    // Cargar CSS (evitar recargar si ya existe)
    if (route.css) {
      let existingLink = [...document.querySelectorAll('link[data-router-style]')]
        .find(el => el.href.endsWith(route.css));
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = route.css;
        link.dataset.routerStyle = 'true';
        document.head.appendChild(link);
      }
      // Elimina otros estilos que no sean el actual
      document.querySelectorAll('link[data-router-style]').forEach(el => {
        if (el.href.endsWith(route.css) === false) el.remove();
      });
    } else {
      // Si no hay CSS definido, eliminar todos los estilos previos
      document.querySelectorAll('link[data-router-style]').forEach(el => el.remove());
    }

    // Cargar HTML
    let res;
    try {
      res = await fetch(route.html);
      if (!res.ok) throw new Error("Error cargando HTML");
    } catch {
      container.innerHTML = "<h2>Error loading page</h2>";
      return;
    }
    const html = await res.text();
    container.innerHTML = html;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    // Importar JS y llamar initPage con manejo de errores
    if (route.js) {
      try {
        if (cacheJsModules.has(route.js)) {
          activeModule = cacheJsModules.get(route.js);
        } else {
          activeModule = await import(route.js);
          cacheJsModules.set(route.js, activeModule);
        }
        if (activeModule && activeModule.initPage) {
          activeModule.initPage(params);
        }
      } catch (e) {
        console.error("Error loading JS module:", e);
        container.innerHTML = "<h2>Error loading script</h2>";
        activeModule = null;
      }
    }

    if (push) {
      history.pushState({ path }, '', path);
    }
  }

  loadRouteFn = loadRoute;

  window.addEventListener('popstate', (e) => {
    const path = e.state?.path || window.location.pathname;
    loadRoute(path, false);
  });

  async function handleRouteChange() {
    const path = window.location.pathname;
    const params = {}; // aquí parsea params de la URL si tienes rutas dinámicas

    if (path.startsWith('/chats/')) {
      // Extraemos roomId de la ruta: /chats/:roomId
      const roomId = path.split('/')[2];
      params.roomId = roomId;

      // Llama a loadChatPage con esos params
      await loadChatPage(params);
    }
    else {
      // otras rutas...
      container.innerHTML = '<h1>Página no encontrada</h1>';
    }
  }

  document.body.addEventListener('click', e => {
    const a = e.target.closest('a[data-link]');
    if (a) {
      e.preventDefault();
      loadRoute(a.getAttribute('href'));
    }
  });
  //handleRouteChange();
  loadRoute(window.location.pathname, false);
}
