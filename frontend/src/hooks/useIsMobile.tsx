import { useEffect, useState } from "react";

type MobileDetectionMode = "device" | "width" | "hybrid";

type UseIsMobileOptions = {
  mode?: MobileDetectionMode;
  maxWidth?: number;
};

const DEFAULT_MAX_WIDTH = 542;

const isTouchDevice = () =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia("(pointer: coarse)").matches;

const isSmallScreen = (maxWidth: number) => window.innerWidth < maxWidth;

const resolveIsMobile = (mode: MobileDetectionMode, maxWidth: number) => {
  if (mode === "device") {
    return isTouchDevice();
  }

  if (mode === "width") {
    return isSmallScreen(maxWidth);
  }

  return isTouchDevice() || isSmallScreen(maxWidth);
};

export default function useIsMobile(options?: UseIsMobileOptions) {
  const mode = options?.mode ?? "device";
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const [isMobile, setIsMobile] = useState(() => resolveIsMobile(mode, maxWidth));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");

    const handleChange = () => {
      setIsMobile(resolveIsMobile(mode, maxWidth));
    };

    mediaQuery.addEventListener("change", handleChange);
    window.addEventListener("resize", handleChange);
    handleChange();

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      window.removeEventListener("resize", handleChange);
    };
  }, [mode, maxWidth]);

  return isMobile;
}
