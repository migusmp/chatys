export default function useFetch() {
    async function fetchFriendsList(): Promise<[] | void> {
        await fetch('/api/user/get-friends', {
            method: "GET",
            credentials: "include"
        })
            .then(res => res.json())
            .then(data => {
                console.log("Friends: ", data);
                return data.data;
                //console.log("Lista de amigos cargada:", GlobalState.get('friends'));
            })
            .catch(e => {
                console.error("Error al cargar la lista de amigos:", e);
            })
    }

    return { fetchFriendsList }
}