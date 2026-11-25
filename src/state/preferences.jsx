import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nova_preferences";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const prefersLight = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;

const DEFAULTS = {
  theme: "system", // "dark" | "light" | "system"
  motion: true, // 3D animation
  model: "Nova Standard",
  temperature: 0.7,
  enterToSend: true,
  webSearch: false,
  sidebarOpen: true,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, motion: !prefersReducedMotion(), ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(load);
  const [systemLight, setSystemLight] = useState(prefersLight);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return undefined;
    const listener = (event) => setSystemLight(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const resolvedTheme = prefs.theme === "system" ? (systemLight ? "light" : "dark") : prefs.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.motion = prefs.motion ? "on" : "off";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolvedTheme === "light" ? "#f4f2fb" : "#05060f");
  }, [resolvedTheme, prefs.motion]);

  const update = useCallback((fields) => setPrefs((current) => ({ ...current, ...fields })), []);

  const value = useMemo(
    () => ({ prefs, update, resolvedTheme }),
    [prefs, update, resolvedTheme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
