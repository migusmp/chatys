import { useEffect, useState } from "react";

const isMobileDevice = () =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.matchMedia('(pointer: coarse)').matches;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileDevice);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');

    const handleChange = () => {
      setIsMobile(isMobileDevice());
    };

    // Solo con addEventListener, sin deprecated fallback
    mediaQuery.addEventListener('change', handleChange);

    window.addEventListener('resize', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  return isMobile;
}
