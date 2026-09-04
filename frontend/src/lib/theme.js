export const THEMES = [
  { id: "royal-blue", name: "Royal Blue", primary: "#2563eb" },
  { id: "emerald", name: "Emerald", primary: "#059669" },
  { id: "violet", name: "Violet", primary: "#7c3aed" },
  { id: "rose", name: "Rose", primary: "#e11d48" },
  { id: "orange", name: "Orange", primary: "#ea580c" },
  { id: "cyan", name: "Cyan", primary: "#0891b2" },
  { id: "indigo", name: "Indigo", primary: "#4f46e5" },
  { id: "teal", name: "Teal", primary: "#0f766e" },
  { id: "amber", name: "Amber", primary: "#d97706" },
  { id: "slate", name: "Slate", primary: "#475569" },
];

const KEY = "parakh_theme";
export const DEFAULT_THEME = "royal-blue";

export function getTheme() {
  const value = localStorage.getItem(KEY);
  return THEMES.some((theme) => theme.id === value) ? value : DEFAULT_THEME;
}

export function applyTheme(themeId) {
  const id = THEMES.some((theme) => theme.id === themeId) ? themeId : DEFAULT_THEME;
  document.documentElement.dataset.theme = id;
  localStorage.setItem(KEY, id);
  return id;
}
