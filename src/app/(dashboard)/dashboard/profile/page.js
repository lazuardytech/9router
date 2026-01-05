"use client";

import { Card, Button, Badge, Toggle } from "@/shared/components";
import { useTheme } from "@/shared/hooks/useTheme";
import { APP_CONFIG } from "@/shared/constants/config";

export default function ProfilePage() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col gap-6">
        {/* Local Mode Info */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">computer</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Local Mode</h2>
              <p className="text-text-muted">Running on your machine</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-text-muted">
              All data is stored locally in the <code className="bg-sidebar px-1 rounded">data/db.json</code> file.
            </p>
          </div>
        </Card>

        {/* Theme Preferences */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-text-muted">
                  Switch between light and dark themes
                </p>
              </div>
              <Toggle
                checked={isDark}
                onChange={() => setTheme(isDark ? "light" : "dark")}
              />
            </div>

            {/* Theme Options */}
            <div className="flex gap-3 pt-4 border-t border-border">
              {["light", "dark", "system"].map((option) => (
                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    theme === option
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {option === "light"
                      ? "light_mode"
                      : option === "dark"
                      ? "dark_mode"
                      : "contrast"}
                  </span>
                  <span className="text-sm font-medium capitalize">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Data</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-bg border border-border">
              <div>
                <p className="font-medium">Database Location</p>
                <p className="text-sm text-text-muted font-mono">~/9router/data/db.json</p>
              </div>
            </div>
          </div>
        </Card>

        {/* App Info */}
        <div className="text-center text-sm text-text-muted py-4">
          <p>{APP_CONFIG.name} v{APP_CONFIG.version}</p>
          <p className="mt-1">Local Mode - All data stored on your machine</p>
        </div>
      </div>
    </div>
  );
}
