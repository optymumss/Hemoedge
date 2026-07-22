"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "he-theme";
type ThemeChoice = "light" | "dark" | "system";

const OPTIONS: { value: ThemeChoice; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light theme." },
  { value: "dark", label: "Dark", description: "Always use the dark theme." },
  { value: "system", label: "System", description: "Match your device's setting." },
];

export function AppearancePanel() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    function readStoredChoice() {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      setChoice(stored === "dark" || stored === "light" ? stored : "system");
    }
    readStoredChoice();
  }, []);

  function choose(value: ThemeChoice) {
    setChoice(value);
    const root = document.documentElement;
    if (value === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", value);
      localStorage.setItem(THEME_STORAGE_KEY, value);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-dim">Choose how HemoEdge looks on this device.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={choice === option.value}
            className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
              choice === option.value
                ? "border-accent bg-accent-soft text-accent-soft-ink"
                : "border-line-strong text-ink hover:bg-surface-sunken"
            }`}
          >
            <span className="font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs text-ink-dim">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
