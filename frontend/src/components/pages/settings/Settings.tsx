import useIsMobileStrict from "../../../hooks/useIsMobileStrict";
import SettingsDesktop from "./components/SettingsDesktop";
import SettingsMobile from "./components/SettingsMobile";

export default function Settings() {
  const isMobile = useIsMobileStrict();
  console.log("Render Settings. isMobile:", isMobile);

  return isMobile ? <SettingsMobile /> : <SettingsDesktop />
}
