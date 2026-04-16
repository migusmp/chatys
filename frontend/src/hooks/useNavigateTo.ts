import { useNavigate } from "react-router-dom";

export function useNavigateTo() {
  const navigate = useNavigate();
  
  const goTo = (path: string) => {
    navigate(path);
  };

  const goBack = () => {
    navigate(-1);
  }
  
  return { goTo, goBack };
}
