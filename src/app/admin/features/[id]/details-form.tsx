"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SummaryField } from "@/components/admin/summary-field";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import {
  updateFeature,
  createFeatureImageUploadTarget,
  confirmFeatureImage,
  removeFeatureImage,
  type FormState,
} from "../actions";

export type FeatureDetails = {
  id: string;
  title: string;
  status: string;
  cell_type_id: string | null;
  definition: string | null;
  why_it_matters: string | null;
  differential_diagnoses: string | null;
  common_confusions: string | null;
};

export function FeatureDetailsForm({
  feature,
  cellTypes,
}: {
  feature: FeatureDetails;
  cellTypes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateFeature, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <input type="hidden" name="id" value={feature.id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-title">Title</label>
          <input
            id="feature-title"
            name="title"
            required
            defaultValue={feature.title}
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-cell-type">Cell type (optional)</label>
          <select
            id="feature-cell-type"
            name="cell_type_id"
            defaultValue={feature.cell_type_id ?? ""}
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
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-definition">Definition</label>
        <textarea
          id="feature-definition"
          name="definition"
          rows={2}
          defaultValue={feature.definition ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-why-it-matters">Why it matters</label>
        <textarea
          id="feature-why-it-matters"
          name="why_it_matters"
          rows={2}
          defaultValue={feature.why_it_matters ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-differential-diagnoses">Differential diagnoses</label>
        <textarea
          id="feature-differential-diagnoses"
          name="differential_diagnoses"
          rows={2}
          defaultValue={feature.differential_diagnoses ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-common-confusions">Common confusions</label>
        <textarea
          id="feature-common-confusions"
          name="common_confusions"
          rows={2}
          defaultValue={feature.common_confusions ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

/** Standalone image upload/replace/remove widget — the image needs its own
 * direct-to-Storage signed upload (see createFeatureImageUploadTarget), so
 * it can't live inside the plain useActionState text-fields form above. */
export function FeatureImageField({
  featureId,
  imageUrl,
}: {
  featureId: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const target = await createFeatureImageUploadTarget(featureId, file.name);
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

      const confirmed = await confirmFeatureImage(featureId, target.path);
      if (confirmed.error) {
        setError(confirmed.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setPending(true);
    try {
      const result = await removeFeatureImage(featureId);
      if (result.error) setError(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line-strong p-3">
      <p className="text-xs font-medium text-ink-dim">Cropped image</p>
      {imageUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="text-xs text-danger underline disabled:opacity-50"
          >
            Remove image
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={pending}
        className="text-sm"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function DetailsSummary({
  feature,
  cellTypeName,
  imageUrl,
}: {
  feature: FeatureDetails;
  cellTypeName: string | null;
  imageUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{feature.title}</h2>
          <StatusBadge status={feature.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(feature.status === "draft" || feature.status === "changes_requested") && (
            <SubmitForReviewButton
              contentType="feature"
              id={feature.id}
              path={`/admin/features/${feature.id}`}
            />
          )}
          <Link
            href={`/admin/features/${feature.id}/edit`}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Edit details
          </Link>
        </div>
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-24 w-24 rounded object-cover" />
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryField label="Cell type" value={cellTypeName} />
      </dl>
      <SummaryField label="Definition" value={feature.definition} multiline />
      <SummaryField label="Why it matters" value={feature.why_it_matters} multiline />
      <SummaryField label="Differential diagnoses" value={feature.differential_diagnoses} multiline />
      <SummaryField label="Common confusions" value={feature.common_confusions} multiline />
    </div>
  );
}
