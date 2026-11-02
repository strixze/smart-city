import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslation from "./locales/en/translation.json";
import mrTranslation from "./locales/mr/translation.json";

const resources = {
  en: {
    translation: enTranslation
  },
  mr: {
    translation: mrTranslation
  }
};

const LANGUAGE_STORAGE_KEY = "smartcity_language";

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "mr"],
    debug: false,
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"]
    }
  });

// Keep document.documentElement.lang synchronized with active language
const updateHtmlLang = (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng || "en";
  }
};

updateHtmlLang(i18n.language);

i18n.on("languageChanged", (lng) => {
  updateHtmlLang(lng);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch (err) {
    console.warn("Unable to save language preference:", err);
  }
});

export default i18n;
