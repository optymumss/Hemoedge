"use client";

import { useState } from "react";
import type { NavLink } from "@/lib/site-settings/clean-nav-links";
import type { SiteSettingsData } from "@/lib/site-settings/get-site-settings";
import { updateSiteSettings } from "@/lib/site-settings/update-site-settings";

const MAX_NAV_LINKS = 8;

type EditableLink = NavLink & { id: string };

function toEditable(links: NavLink[]): EditableLink[] {
  return links.map((l) => ({ ...l, id: crypto.randomUUID() }));
}

export function SiteSettingsForm({ initial }: { initial: SiteSettingsData }) {
  const [siteName, setSiteName] = useState(initial.siteName);
  const [links, setLinks] = useState<EditableLink[]>(() => toEditable(initial.navLinks));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateLink(id: string, field: "label" | "href", value: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), label: "", href: "" }]);
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await updateSiteSettings(
      siteName,
      links.map(({ label, href }) => ({ label, href })),
    );
    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="site-name">
          Site name
        </label>
        <input
          id="site-name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-ink-dim">Navigation &amp; footer links</span>
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2">
            <input
              placeholder="Label"
              aria-label="Link label"
              value={link.label}
              onChange={(e) => updateLink(link.id, "label", e.target.value)}
              className="w-40 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <input
              placeholder="/href"
              aria-label="Link URL"
              value={link.href}
              onChange={(e) => updateLink(link.id, "href", e.target.value)}
              className="w-48 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLink(link.id)}
              className="text-xs text-danger underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addLink}
          disabled={links.length >= MAX_NAV_LINKS}
          className="self-start text-xs text-info-soft-ink underline disabled:opacity-50"
        >
          Add link
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Saved.</p>}
    </form>
  );
}
