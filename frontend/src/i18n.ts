// Importa la instancia principal de i18next (la librería de internacionalización)
import i18n from "i18next";

// Importa el adaptador para integrar i18next con React (para usar hooks como useTranslation)
import { initReactI18next } from "react-i18next";

// Importa el plugin para detectar el idioma del navegador o el previamente guardado
import LanguageDetector from "i18next-browser-languagedetector";

// Importa los archivos de traducción para inglés y español
import enTranslation from "./locales/en/translation.json";
import esTranslation from "./locales/es/translation.json";

// Configura i18n
i18n
    .use(LanguageDetector) // Usa el detector de idioma para detectar automáticamente el idioma del navegador o localStorage
    .use(initReactI18next) // Conecta i18n con React para que funcione con sus componentes
    .init({ // Inicializa i18n con las opciones de configuración
        fallbackLng: "en", // Idioma a usar si no se detecta otro
        // Recursos de traducción disponibles
        resources: {
            en: { translation: enTranslation },
            es: { translation: esTranslation },
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;