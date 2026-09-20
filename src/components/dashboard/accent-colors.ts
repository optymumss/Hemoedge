export type AccentColor = "red" | "orange" | "green" | "purple";

export const ACCENT_ICON_CLASSES: Record<AccentColor, string> = {
  red: "bg-danger-soft text-danger-soft-ink",
  orange: "bg-warning-soft text-warning-soft-ink",
  green: "bg-success-soft text-success-soft-ink",
  purple: "bg-accent-soft text-accent-soft-ink",
};
