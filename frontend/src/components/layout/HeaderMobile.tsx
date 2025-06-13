import chatysLogo from '../../assets/logo_individual_claro.png';
import { useUserContext } from '../../context/UserContext';

export default function HeaderMobile() {
    const { user } = useUserContext();

    return (
        <header className="layout__header">
            <div className="layout__header-left">
                <img
                    src={user?.image}
                    alt="User"
                    className="layout__user-avatar"
                />
            </div>
            <div className="layout__header-center">
                <img src={chatysLogo} className="layout__logo" />
            </div>
            <div className="layout__header-right">{/* vacío por ahora */}</div>
        </header>
    )
}