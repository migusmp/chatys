import { useNavigate } from "react-router-dom";

export default function BackButtonMobile({ link = "" }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (link.length > 0) {
      navigate(link);
      return;
    }
    navigate(-1);
  };

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="2em" 
      height="2em" 
      viewBox="0 0 24 24"
      onClick={goBack}
      style={{ cursor: "pointer" }} // para que parezca clickeable
    >
      <path fill="#0f6" d="M13.83 19a1 1 0 0 1-.78-.37l-4.83-6a1 1 0 0 1 0-1.27l5-6a1 1 0 0 1 1.54 1.28L10.29 12l4.32 5.36a1 1 0 0 1-.78 1.64" />
    </svg>
  );
}
