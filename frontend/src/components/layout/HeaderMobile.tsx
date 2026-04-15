import chatysLogo from '../../assets/logo_individual_claro.png';
import { useUserProfileContext } from '../../context/UserContext';
import NotificationIcon from '../bar_icons/NotificationIcon';

export default function HeaderMobile() {
  const { user } = useUserProfileContext();

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
      <div className="layout__header-right">
        <NotificationIcon />
      </div>
    </header>
  )
}
