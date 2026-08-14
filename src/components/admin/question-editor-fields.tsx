"use client";

import { useState } from "react";
import { QUESTION_TYPES, QUESTION_TYPE_LABEL, type QuestionType } from "@/lib/quiz/types";

export type FeatureOption = { id: string; title: string };

const CHOICE_IDS = ["a", "b", "c", "d"] as const;

/**
 * Shared authoring fields for a quiz question, used by both the case-study
 * and module question forms (same quiz_questions table, same shape). Always
 * renders checkboxes for "correct" rather than switching input type per
 * question type — server-side validation enforces exactly one for
 * single_choice/true_false/image_match and one-or-more for multi_select,
 * which keeps this component's markup uniform.
 */
export function QuestionEditorFields({ features }: { features: FeatureOption[] }) {
  const [type, setType] = useState<QuestionType>("single_choice");

  return (
    <>
      <select
        name="question_type"
        value={type}
        onChange={(e) => setType(e.target.value as QuestionType)}
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      >
        {QUESTION_TYPES.map((value) => (
          <option key={value} value={value}>
            {QUESTION_TYPE_LABEL[value]}
          </option>
        ))}
      </select>

      <input
        name="question_text"
        required
        placeholder={type === "image_match" ? "Caption (optional)" : "Question text"}
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />

      {type === "image_match" && (
        <select
          name="feature_id"
          required
          defaultValue=""
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose the image to show…
          </option>
          {features.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      )}

      {type !== "short_answer" && (
        <>
          {CHOICE_IDS.filter((id) => type !== "true_false" || id === "a" || id === "b").map((id) => {
            const isTrueFalse = type === "true_false";
            const fixedText = id === "a" ? "True" : "False";
            return (
              <div key={id} className="flex items-center gap-2">
                <input type="checkbox" name="correct" value={id} className="shrink-0" />
                <input
                  name={`choice_${id}`}
                  defaultValue={isTrueFalse ? fixedText : undefined}
                  readOnly={isTrueFalse}
                  placeholder={`Choice ${id.toUpperCase()}${id === "a" || id === "b" ? " (required)" : " (optional)"}`}
                  required={id === "a" || id === "b"}
                  className="flex-1 rounded-md border border-line-strong px-2 py-1.5 text-sm read-only:bg-surface-sunken"
                />
              </div>
            );
          })}
          <p className="text-xs text-ink-faint">
            {type === "multi_select" ? "Check every correct choice." : "Check the one correct choice."}
          </p>
        </>
      )}

      {type === "short_answer" && (
        <p className="text-xs text-ink-faint">
          The learner types a free-text response — grade it afterward from the Grading Queue.
        </p>
      )}

      <textarea
        name="model_answer"
        rows={2}
        placeholder="Model answer (optional) — shown to the learner after they submit, and as grading guidance for short answers"
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />
    </>
  );
}
