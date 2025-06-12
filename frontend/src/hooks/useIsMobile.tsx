// src/hooks/useIsMobile.ts
import { useEffect, useState } from "react";

const isMobileDevice = () => {
  return (
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches
  );
};

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  useEffect(() => {
    // Ya que userAgent no cambia, no necesitamos escuchar el resize
    // Pero si aún quieres permitir cambios manuales (por emuladores), puedes mantenerlo
    setIsMobile(isMobileDevice());
  }, []);

  return isMobile;
}


// const isMobileInitial = () => {
//   return (
//     window.innerWidth <= 500 ||
//     /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
//   );
// };

// export default function useIsMobile() {
//   const [isMobile, setIsMobile] = useState(isMobileInitial);

//   useEffect(() => {
//     const handleResize = () => {
//       setIsMobile(window.innerWidth <= 500);
//     };

//     window.addEventListener("resize", handleResize);
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);

//   return isMobile;
// }
