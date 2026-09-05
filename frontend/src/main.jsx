import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AutoTranslate from "./components/AutoTranslate";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/theme.css";
import "./styles/responsive.css";
import "./styles/theme-overrides.css";
import "./styles/performance-overrides.css";
import "./styles/modern-system.css";
import "./styles/dark-contrast.css";
import { applyTheme, getTheme } from "./lib/theme";
import { LanguageProvider } from "./components/LanguageProvider";

applyTheme(getTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <AutoTranslate />
      <App />
    </LanguageProvider>
  </StrictMode>
);
