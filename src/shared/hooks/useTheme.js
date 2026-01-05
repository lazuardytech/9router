"use client";

import { useEffect } from "react";
import useThemeStore from "@/store/themeStore";

export function useTheme() {
  const { theme, setTheme, toggleTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        initTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, initTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches),
  };
}

