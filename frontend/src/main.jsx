import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/components.css";
import { applyTheme, getTheme } from "./lib/theme";

applyTheme(getTheme());
import "./styles/theme.css";
import { applyTheme, getTheme } from "./lib/theme";

applyTheme(getTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
