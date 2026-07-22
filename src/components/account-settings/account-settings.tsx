"use client";

import { useState } from "react";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { AppearancePanel } from "./appearance-panel";
import { DeleteAccountSection } from "./delete-account-section";

type Tab = "profile" | "password" | "appearance";

const TABS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "password", label: "Password" },
  { value: "appearance", label: "Appearance" },
];

export function AccountSettings({
  fullName,
  email,
  canDeleteAccount,
}: {
  fullName: string;
  email: string;
  canDeleteAccount: boolean;
}) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <nav aria-label="Settings" className="flex shrink-0 flex-row gap-1 sm:w-44 sm:flex-col">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-current={tab === t.value ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
              tab === t.value
                ? "bg-surface-sunken font-medium text-ink"
                : "text-ink-dim hover:bg-surface-sunken"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="max-w-2xl flex-1">
        {tab === "profile" && (
          <div className="flex flex-col gap-8">
            <ProfileForm fullName={fullName} email={email} />
            {canDeleteAccount && <DeleteAccountSection />}
          </div>
        )}
        {tab === "password" && <PasswordForm />}
        {tab === "appearance" && <AppearancePanel />}
      </div>
    </div>
  );
}
