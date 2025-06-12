import { useTranslation } from "react-i18next";

export default function SelectLanguage() {
 const { i18n } = useTranslation();

  const changeToEnglish = () => {
    i18n.changeLanguage('en');
  };

  const changeToSpanish = () => {
    i18n.changeLanguage('es');
  };
    return (
        <>
            <button onClick={changeToEnglish}>English</button>
            <button onClick={changeToSpanish}>Español</button>
        </>
    )
}