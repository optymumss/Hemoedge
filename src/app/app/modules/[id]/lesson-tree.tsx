"use client";

import { useState } from "react";
import { AnnotatedSlideViewer } from "@/components/annotated-slide-viewer";

type Lesson = {
  id: string;
  title: string;
  body: string | null;
  slide_id: string | null;
};

export function LessonTree({ lessons }: { lessons: Lesson[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(lessons[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      {lessons.map((lesson, i) => {
        const isExpanded = expandedId === lesson.id;
        return (
          <div key={lesson.id} className="rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : lesson.id)}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-ink">
                {i + 1}. {lesson.title}
              </span>
              <span aria-hidden="true" className="shrink-0 text-ink-faint">
                {isExpanded ? "−" : "+"}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-line px-4 py-3">
                {lesson.body && (
                  <p className="whitespace-pre-wrap text-sm text-ink-dim">{lesson.body}</p>
                )}

                {lesson.slide_id && (
                  <div className="mt-3">
                    <AnnotatedSlideViewer slideId={lesson.slide_id} heightClassName="h-[28rem]" />
                  </div>
                )}

                {!lesson.body && !lesson.slide_id && (
                  <p className="text-sm text-ink-faint">No content added yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
