import type { ReactNode } from "react";
import { ACCENT_ICON_CLASSES, type AccentColor } from "./accent-colors";

export function IconBadge({ icon, accentColor }: { icon: ReactNode; accentColor: AccentColor }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_ICON_CLASSES[accentColor]}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
