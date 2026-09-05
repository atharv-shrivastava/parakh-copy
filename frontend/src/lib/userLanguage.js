import { isSupportedLanguage } from "./language";

export function getUserLanguagePreference(userId) {
  if (!userId) return null;
  const value = localStorage.getItem(`parakh_language_${userId}`);
  return isSupportedLanguage(value) ? value : null;
}
