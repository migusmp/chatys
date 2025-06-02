export const WSChat = (() => {
    let generalStatsSocket = null;
    let generalStats = null;
    let generalStatsCallback = null;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

    const sockets = new Map();       // para mensajes de sala
    const statsSockets = new Map();  // para estadísticas de sala
    const roomStats = {};            // usuarios por sala
    const messages = {};

    function getSocket(roomId) {
        return sockets.get(roomId);
    }

    function getStatsSocket(roomId) {
        return statsSockets.get(roomId);
    }
    function leaveRoom(roomId) {
        const socket = sockets.get(roomId);
        try {
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                socket.close();
            }
        } catch (err) {
            console.warn(`Error al cerrar socket de ${roomId}`, err);
        }
        sockets.delete(roomId);

        const statsSocket = statsSockets.get(roomId);
        try {
            if (statsSocket && (statsSocket.readyState === WebSocket.OPEN || statsSocket.readyState === WebSocket.CONNECTING)) {
                statsSocket.close();
            }
        } catch (err) {
            console.warn(`Error al cerrar stats socket de ${roomId}`, err);
        }
        statsSockets.delete(roomId);
    }


    function getGeneralStats() {
        return generalStats;
    }

    function getRoomStats(roomId) {
        return roomStats[roomId];
    }

    function getMessages(roomId) {
        return messages[roomId] || [];
    }

    function connectGeneralStats(onData) {
        generalStatsCallback = onData;

        generalStatsSocket = new WebSocket(`${protocol}://${location.host}/api/chat/active-rooms`);

        generalStatsSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                generalStats = {
                    activeRooms: data.rooms_active,
                    totalRooms: data.rooms_length,
                    activeUsers: data.users_active,
                };

                if (generalStatsCallback) {
                    generalStatsCallback(generalStats);
                }
            } catch (error) {
                console.error("Error parseando estadísticas generales:", error);
            }
        };

        generalStatsSocket.onerror = (e) => {
            console.error("Error en WebSocket de estadísticas generales:", e);
        };

        generalStatsSocket.onclose = () => {
            console.log("Conexión de estadísticas generales cerrada");
        };
        // Retornamos la función para desconectar y limpiar todo
        return generalStatsSocket;
    }

    function closeRoomConnections(roomId) {
        const oldSocket = sockets.get(roomId);
        if (oldSocket) {
            oldSocket.close();
            sockets.delete(roomId);
        }

        const oldStatsSocket = statsSockets.get(roomId);
        if (oldStatsSocket) {
            oldStatsSocket.close();
            statsSockets.delete(roomId);
        }
    }

    function joinRoom(roomId) {
        const existing = sockets.get(roomId);
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            console.warn(`Ya existe una conexión activa o en proceso para la sala: ${roomId}`);
            return existing;
        }
        closeRoomConnections(roomId);

        const socket = new WebSocket(`${protocol}://${location.host}/api/chat/join/${roomId}`);
        sockets.set(roomId, socket);

        socket.onopen = () => {
            console.log(`Conexión WebSocket abierta para la sala: ${roomId}`);
        };

        socket.onmessage = (e) => {
            //console.log(`Mensaje recibido en ${roomId}:`, e.data);
            if (!messages[roomId]) messages[roomId] = [];
            try {
                const parsed = JSON.parse(e.data);
                messages[roomId].push(parsed);
            } catch {
                messages[roomId].push({ message: e.data });
            }
        };

        socket.onerror = (e) => {
            if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
                console.error(`Error en la sala ${roomId}:`, e);
            }
        };

        socket.onclose = () => {
            console.log(`Conexión cerrada para la sala: ${roomId}`);
            // sockets.delete(roomId);
            sockets.delete(roomId);
        };

        const statsSocket = new WebSocket(`${protocol}://${location.host}/api/chat/stats/${roomId}`);
        statsSockets.set(roomId, statsSocket);

        statsSocket.onmessage = (e) => {
            roomStats[roomId] = {
                users: parseInt(e.data, 10),
            };
            //console.log(`Estadísticas de ${roomId}:`, roomStats[roomId]);

            // Actualiza UI si ya se están mostrando salas
            const roomElem = document.querySelector(`[data-room-id="${roomId}"]`);
            if (roomElem) {
                const span = roomElem.querySelector(".users-count");
                if (span) {
                    span.textContent = `👥 ${roomStats[roomId].users}`;
                }
            }
        };

        statsSocket.onerror = (e) => {
            console.error(`Error en estadísticas de ${roomId}:`, e);
        };

        statsSocket.onclose = () => {
            console.log(`Conexión de estadísticas cerrada para ${roomId}`);
            // statsSockets.delete(roomId);
            statsSockets.delete(roomId);
        };

        return socket;
    }

    function sendMessage(roomId, msg) {
        const socket = sockets.get(roomId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(msg);
        } else {
            console.error(`No se puede enviar el mensaje, socket no conectado para ${roomId}`);
        }
    }

    function closeRoom(roomId) {
        const socket = sockets.get(roomId);
        const statsSocket = statsSockets.get(roomId);

        if (socket) socket.close();
        if (statsSocket) statsSocket.close();

        sockets.delete(roomId);
        statsSockets.delete(roomId);
        console.log(`Sala ${roomId} cerrada`);
    }

    function closeAllConnections() {
        sockets.forEach(socket => socket.close());
        statsSockets.forEach(socket => socket.close());
        if (generalStatsSocket) generalStatsSocket.close();

        sockets.clear();
        statsSockets.clear();
        generalStatsSocket = null;
        console.log("Todas las conexiones cerradas");
    }

    return {
        connectGeneralStats,
        joinRoom,
        sendMessage,
        closeRoom,
        closeAllConnections,
        getGeneralStats,
        getRoomStats,
        getMessages,
        getStatsSocket,
        getSocket,
        leaveRoom,
    };
})();