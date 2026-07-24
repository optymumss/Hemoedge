"use client";

import { useActionState, useState } from "react";
import { updateLesson, deleteLesson, moveLesson, type FormState } from "./actions";

export type LessonRowData = {
  id: string;
  title: string;
  body: string | null;
  slide_id: string | null;
};

export function LessonRow({
  lesson,
  moduleId,
  slides,
  index,
  total,
}: {
  lesson: LessonRowData;
  moduleId: string;
  slides: { id: string; title: string }[];
  index: number;
  total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateLesson,
    undefined,
  );
  const linkedSlide = slides.find((s) => s.id === lesson.slide_id);

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {index + 1}. {lesson.title}
          </p>
          {lesson.body && (
            <p className="mt-1 line-clamp-2 text-sm text-ink-dim">{lesson.body}</p>
          )}
          {linkedSlide && (
            <p className="mt-1 text-xs text-ink-faint">Slide: {linkedSlide.title}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <form action={moveLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <input type="hidden" name="module_id" value={moduleId} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={index === 0}
              aria-label="Move up"
              className="rounded px-1.5 py-1 text-ink-dim hover:bg-surface-sunken disabled:opacity-30"
            >
              ↑
            </button>
          </form>
          <form action={moveLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <input type="hidden" name="module_id" value={moduleId} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={index === total - 1}
              aria-label="Move down"
              className="rounded px-1.5 py-1 text-ink-dim hover:bg-surface-sunken disabled:opacity-30"
            >
              ↓
            </button>
          </form>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-xs text-ink-dim underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <form action={deleteLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <input type="hidden" name="module_id" value={moduleId} />
            <button type="submit" className="text-xs text-danger underline">
              Delete
            </button>
          </form>
        </div>
      </div>

      {editing && (
        <form action={action} className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="module_id" value={moduleId} />
          <input
            name="title"
            required
            defaultValue={lesson.title}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <textarea
            name="body"
            rows={4}
            defaultValue={lesson.body ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <select
            name="slide_id"
            defaultValue={lesson.slide_id ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">No slide</option>
            {slides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
