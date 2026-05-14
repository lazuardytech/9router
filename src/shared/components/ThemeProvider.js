"use client";

// Theme is always dark — this provider is kept for compatibility
// with any code that imports ThemeProvider.
export function ThemeProvider({ children }) {
  return <>{children}</>;
}
