import useIsMobile from "../../../hooks/useIsMobile";
import SettingsDesktop from "./components/SettingsDesktop";
import SettingsMobile from "./components/SettingsMobile";

export default function Settings() {
  const isMobile = useIsMobile();
  console.log("Render Settings. isMobile:", isMobile);

  return isMobile ? <SettingsMobile /> : <SettingsDesktop />
}
