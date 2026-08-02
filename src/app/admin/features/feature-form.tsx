"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createFeature, createFeatureImageUploadTarget, confirmFeatureImage } from "./actions";

export function FeatureForm({
  cellTypes,
}: {
  cellTypes: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const cellTypeId = String(data.get("cell_type_id") ?? "") || null;
    const definition = String(data.get("definition") ?? "").trim() || null;
    const whyItMatters = String(data.get("why_it_matters") ?? "").trim() || null;
    const differentialDiagnoses = String(data.get("differential_diagnoses") ?? "").trim() || null;
    const commonConfusions = String(data.get("common_confusions") ?? "").trim() || null;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!title) return setError("Title is required.");

    setPending(true);
    try {
      const created = await createFeature(
        title,
        cellTypeId,
        definition,
        whyItMatters,
        differentialDiagnoses,
        commonConfusions,
      );
      if ("error" in created) {
        setError(created.error);
        return;
      }

      if (file) {
        const target = await createFeatureImageUploadTarget(created.featureId, file.name);
        if ("error" in target) {
          setError(target.error);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("feature-images")
          .uploadToSignedUrl(target.path, target.token, file);

        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const confirmed = await confirmFeatureImage(created.featureId, target.path);
        if (confirmed.error) {
          setError(confirmed.error);
          return;
        }
      }

      formRef.current?.reset();
      window.location.reload();
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-title">Title</label>
          <input
            id="feature-title"
            name="title"
            required
            placeholder="Schistocyte (Red Cell Fragment)"
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-cell-type">Cell type (optional)</label>
          <select
            id="feature-cell-type"
            name="cell_type_id"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {cellTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-image">Cropped image (optional)</label>
          <input
            id="feature-image"
            name="image"
            type="file"
            accept="image/*"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-definition">Definition</label>
        <textarea
          id="feature-definition"
          name="definition"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-why-it-matters">Why it matters</label>
        <textarea
          id="feature-why-it-matters"
          name="why_it_matters"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-differential-diagnoses">Differential diagnoses</label>
        <textarea
          id="feature-differential-diagnoses"
          name="differential_diagnoses"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-common-confusions">Common confusions</label>
        <textarea
          id="feature-common-confusions"
          name="common_confusions"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft feature"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
