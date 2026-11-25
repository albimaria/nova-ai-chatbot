import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { PreferencesProvider } from "./state/preferences";
import { ToastProvider } from "./state/toast";

import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PreferencesProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </PreferencesProvider>
  </StrictMode>
);
