import { initRouter } from "./router.js";
import { GlobalState } from "./state.js"

document.addEventListener('DOMContentLoaded', function() {

    GlobalState.init().then(() => {
        //console.log("GlobalState initialized successfully");
    });

    const container = document.getElementById('app');
    initRouter(container);
})