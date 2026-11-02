import React from "react";
import { useTranslation } from "react-i18next";
import { Languages, Globe } from "lucide-react";

/**
 * LanguageSwitcher Component
 *
 * Provides instant language switching between English and मराठी (Marathi).
 * Supports segmented pill style, compact mobile button, or dropdown.
 * Updates immediately without requiring a page reload.
 */
export const LanguageSwitcher = ({
  variant = "segmented", // 'segmented' | 'compact' | 'dropdown'
  className = ""
}) => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language?.startsWith("mr") ? "mr" : "en";

  const handleLanguageChange = (newLang) => {
    if (newLang !== currentLang) {
      i18n.changeLanguage(newLang);
    }
  };

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center rounded-xl bg-slate-900/80 p-0.5 border border-slate-700/70 shadow-xs backdrop-blur-md ${className}`}
        role="group"
        aria-label="Language selection"
      >
        <button
          type="button"
          onClick={() => handleLanguageChange("en")}
          aria-pressed={currentLang === "en"}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            currentLang === "en"
              ? "bg-teal-500 text-slate-950 font-bold shadow-xs"
              : "text-slate-300 hover:text-white hover:bg-slate-800/60"
          }`}
          title="Switch to English"
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => handleLanguageChange("mr")}
          aria-pressed={currentLang === "mr"}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            currentLang === "mr"
              ? "bg-teal-500 text-slate-950 font-bold shadow-xs"
              : "text-slate-300 hover:text-white hover:bg-slate-800/60"
          }`}
          title="मराठीमध्ये बदला"
        >
          मराठी
        </button>
      </div>
    );
  }

  // Default: Segmented Switcher with Globe Icon
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-md backdrop-blur-md ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <div className="pl-1.5 pr-0.5 text-teal-400 flex items-center">
        <Languages className="w-3.5 h-3.5" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={() => handleLanguageChange("en")}
        aria-pressed={currentLang === "en"}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-200 ${
          currentLang === "en"
            ? "bg-teal-500 text-slate-950 font-bold shadow-xs"
            : "text-slate-300 hover:text-white hover:bg-slate-800/60"
        }`}
      >
        <span>English</span>
      </button>

      <span className="text-slate-600 text-xs select-none">|</span>

      <button
        type="button"
        onClick={() => handleLanguageChange("mr")}
        aria-pressed={currentLang === "mr"}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-200 ${
          currentLang === "mr"
            ? "bg-teal-500 text-slate-950 font-bold shadow-xs"
            : "text-slate-300 hover:text-white hover:bg-slate-800/60"
        }`}
      >
        <span>मराठी</span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;
