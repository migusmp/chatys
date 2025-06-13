import FriendCard from './FriendCard'
import styles from '../css/Friends.module.css'

type Friend = {
    id: string
    name: string
    username: string
    profileImage: string
}

const mockFriends: Friend[] = [
    {
        id: "1",
        name: "Juan Pérez",
        username: "juanp",
        profileImage: "https://i.pravatar.cc/150?img=3"
    },
    {
        id: "2",
        name: "María López",
        username: "marial",
        profileImage: "https://i.pravatar.cc/150?img=5"
    },
    {
        id: "3",
        name: "María López",
        username: "marial",
        profileImage: "https://i.pravatar.cc/150?img=5"
    },
    {
        id: "4",
        name: "María López",
        username: "marial",
        profileImage: "https://i.pravatar.cc/150?img=5"
    },
    {
        id: "5",
        name: "Manolo García",
        username: "manolakooo",
        profileImage: "https://i.pravatar.cc/150?img=4"
    }
]

export default function Friends() {

    return (
        <section className={styles.sectionFriends}>
            {mockFriends.map(friend => (
                <FriendCard key={friend.id} friend={friend} />
            ))}
        </section>
    )
}