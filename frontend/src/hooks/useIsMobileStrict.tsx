import useIsMobile from "./useIsMobile";

export default function useIsMobileStrict() {
  return useIsMobile({ mode: "width", maxWidth: 542 });
}
