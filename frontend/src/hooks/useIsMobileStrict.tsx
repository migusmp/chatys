// src/hooks/useIsMobileStrict.ts
import { useEffect, useState } from "react";

const isSmallScreen = () => window.innerWidth < 542;

export default function useIsMobileStrict() {
  const [isMobile, setIsMobile] = useState(isSmallScreen);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isSmallScreen());
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Ejecuta una vez por si el tamaño cambia antes del listener

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}
