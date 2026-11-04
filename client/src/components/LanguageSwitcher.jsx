import React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

/**
 * LanguageSwitcher Component
 *
 * Provides instant language switching between English and मराठी (Marathi).
 * Supports segmented pill style, compact mobile button, or dropdown.
 * Styled to seamlessly match the civic dashboard theme across Citizen, Admin, and Staff panels.
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
        className={`inline-flex items-center rounded-xl bg-white p-0.5 border border-[#E2E8F0] shadow-2xs ${className}`}
        role="group"
        aria-label="Language selection"
      >
        <button
          type="button"
          onClick={() => handleLanguageChange("en")}
          aria-pressed={currentLang === "en"}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            currentLang === "en"
              ? "bg-[#0D9488] text-white shadow-xs font-bold"
              : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
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
              ? "bg-[#0D9488] text-white shadow-xs font-bold"
              : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
          }`}
          title="मराठीमध्ये बदला"
        >
          मराठी
        </button>
      </div>
    );
  }

  // Default: Segmented Switcher with Globe / Languages Icon
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <div className="pl-1.5 pr-0.5 text-[#0D9488] flex items-center">
        <Languages className="w-3.5 h-3.5" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={() => handleLanguageChange("en")}
        aria-pressed={currentLang === "en"}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all duration-200 ${
          currentLang === "en"
            ? "bg-[#0D9488] text-white font-bold shadow-xs"
            : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] font-medium"
        }`}
      >
        <span>English</span>
      </button>

      <span className="text-[#CBD5E1] text-xs select-none">|</span>

      <button
        type="button"
        onClick={() => handleLanguageChange("mr")}
        aria-pressed={currentLang === "mr"}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all duration-200 ${
          currentLang === "mr"
            ? "bg-[#0D9488] text-white font-bold shadow-xs"
            : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] font-medium"
        }`}
      >
        <span>मराठी</span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;
