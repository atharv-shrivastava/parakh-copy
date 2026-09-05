export const THEMES = [
  { id: "royal-blue", name: "Royal Blue", primary: "#2563eb", background: "#f5f7fb", surface: "#ffffff", text: "#172033", muted: "#647084", border: "#e1e6ef", sidebar: "#111827" },
  { id: "emerald", name: "Emerald", primary: "#059669", background: "#f0fdf4", surface: "#ffffff", text: "#10231c", muted: "#60756c", border: "#d9eee4", sidebar: "#073b2d" },
  { id: "violet", name: "Violet", primary: "#7c3aed", background: "#faf5ff", surface: "#ffffff", text: "#21162f", muted: "#70647e", border: "#eadff7", sidebar: "#27104d" },
  { id: "rose", name: "Rose", primary: "#e11d48", background: "#fff7f9", surface: "#ffffff", text: "#2b151c", muted: "#78636a", border: "#f0dce2", sidebar: "#4a1021" },
  { id: "orange", name: "Orange", primary: "#ea580c", background: "#fffaf5", surface: "#ffffff", text: "#2d1a10", muted: "#78685d", border: "#f1e1d6", sidebar: "#431608" },
  { id: "cyan", name: "Cyan", primary: "#0891b2", background: "#f0fdff", surface: "#ffffff", text: "#10272c", muted: "#61767b", border: "#d8ecef", sidebar: "#083344" },
  { id: "indigo", name: "Indigo", primary: "#4f46e5", background: "#f5f7ff", surface: "#ffffff", text: "#171a35", muted: "#646a84", border: "#dfe3f2", sidebar: "#171654" },
  { id: "teal", name: "Teal", primary: "#0f766e", background: "#f0fdfa", surface: "#ffffff", text: "#102422", muted: "#607572", border: "#d8ebe8", sidebar: "#0b3633" },
  { id: "amber", name: "Amber", primary: "#d97706", background: "#fffdf5", surface: "#ffffff", text: "#2b2010", muted: "#756955", border: "#eee5cc", sidebar: "#402b05" },
  { id: "slate", name: "Slate", primary: "#475569", background: "#f8fafc", surface: "#ffffff", text: "#16202d", muted: "#64748b", border: "#dbe3ec", sidebar: "#172033" },
  { id: "dark", name: "Midnight Dark", primary: "#60a5fa", background: "#0b1120", surface: "#111827", text: "#f1f5f9", muted: "#9ca9bb", border: "#253149", sidebar: "#050914" },
  { id: "dark-emerald", name: "Forest Dark", primary: "#34d399", background: "#071611", surface: "#0d2118", text: "#ecfdf5", muted: "#9cc4b0", border: "#1c4031", sidebar: "#03100b" },
  { id: "dark-violet", name: "Nebula Dark", primary: "#a78bfa", background: "#100c1b", surface: "#171225", text: "#f5f3ff", muted: "#b3a8c8", border: "#30264a", sidebar: "#08050f" },
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
  document.documentElement.style.colorScheme = id.startsWith("dark") || id === "dark" ? "dark" : "light";
  localStorage.setItem(KEY, id);
  return id;
}
