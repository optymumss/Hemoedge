"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createSlideUploadTarget, confirmSlideUpload } from "./actions";

export function UploadForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    const categoryId = String(new FormData(form).get("category_id") ?? "") || null;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!title) return setError("Title is required.");
    if (!file) return setError("Choose a file to upload.");

    setPending(true);
    try {
      const target = await createSlideUploadTarget(title, categoryId, file.name);
      if ("error" in target) {
        setError(target.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("slides")
        .uploadToSignedUrl(target.path, target.token, file);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const confirmed = await confirmSlideUpload(target.slideId, file.size);
      if (confirmed.error) {
        setError(confirmed.error);
        return;
      }

      formRef.current?.reset();
      window.location.reload();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="slide-title">Title</label>
        <input
          id="slide-title"
          name="title"
          required
          placeholder="Peripheral smear — schistocytes"
          className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="slide-category">Category (optional)</label>
        <select
          id="slide-category"
          name="category_id"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="slide-file">File</label>
        <input
          id="slide-file"
          name="file"
          type="file"
          required
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload slide"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
