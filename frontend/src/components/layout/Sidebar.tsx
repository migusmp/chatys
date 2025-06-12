import '../../styles/layouts/Sidebar.css';
import SidebarMovile from './SidebarMovile';
import SidebarDesktop from './SidebarDesktop';
import useIsMobile from '../../hooks/useIsMobile';

export default function Sidebar() {
  const isMobile = useIsMobile();

  return isMobile ? <SidebarMovile /> : <SidebarDesktop />;
}

