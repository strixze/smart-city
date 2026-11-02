import i18n from "../i18n";

/**
 * Formats a date using Indian English or Marathi locale.
 */
export const formatDate = (date, options = {}) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";

  const lang = i18n.language?.startsWith("mr") ? "mr-IN" : "en-IN";

  const defaultOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options
  };

  try {
    return new Intl.DateTimeFormat(lang, defaultOptions).format(d);
  } catch (err) {
    return d.toLocaleDateString();
  }
};

/**
 * Formats date and time.
 */
export const formatDateTime = (date, options = {}) => {
  return formatDate(date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...options
  });
};

/**
 * Formats numeric values using the Indian numbering system.
 */
export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  const lang = i18n.language?.startsWith("mr") ? "mr-IN" : "en-IN";
  try {
    return new Intl.NumberFormat(lang, options).format(num);
  } catch (err) {
    return String(num);
  }
};

/**
 * Returns localized category name for display.
 * The underlying value in database remains canonical English.
 */
export const getLocalizedCategory = (category, t) => {
  if (!category) return "";
  if (typeof t === "function") {
    const translated = t(`categories.${category}`);
    if (translated && !translated.startsWith("categories.")) {
      return translated;
    }
  }
  return category;
};

/**
 * Returns localized subcategory name for display.
 */
export const getLocalizedSubcategory = (subcategory, t) => {
  if (!subcategory) return "";
  if (typeof t === "function") {
    const translated = t(`subcategories.${subcategory}`);
    if (translated && !translated.startsWith("subcategories.")) {
      return translated;
    }
  }
  return subcategory;
};

/**
 * Returns localized status name for display.
 */
export const getLocalizedStatus = (status, t) => {
  if (!status) return "";
  if (typeof t === "function") {
    const translated = t(`status.${status}`);
    if (translated && !translated.startsWith("status.")) {
      return translated;
    }
  }
  return status;
};

/**
 * Returns localized priority name for display.
 */
export const getLocalizedPriority = (priority, t) => {
  if (!priority) return "";
  if (typeof t === "function") {
    const translated = t(`priority.${priority}`);
    if (translated && !translated.startsWith("priority.")) {
      return translated;
    }
  }
  return priority;
};
