"use client";

import { useState } from "react";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { WsiViewer } from "@/components/wsi-viewer";

type Lesson = {
  id: string;
  title: string;
  body: string | null;
  slide_id: string | null;
};

export function LessonTree({ lessons }: { lessons: Lesson[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(lessons[0]?.id ?? null);
  const [slideUrls, setSlideUrls] = useState<Record<string, string>>({});
  const [slideErrors, setSlideErrors] = useState<Record<string, string>>({});
  const [loadingSlideId, setLoadingSlideId] = useState<string | null>(null);

  async function toggle(lesson: Lesson) {
    const nextExpanded = expandedId === lesson.id ? null : lesson.id;
    setExpandedId(nextExpanded);

    if (nextExpanded && lesson.slide_id && !slideUrls[lesson.id]) {
      setLoadingSlideId(lesson.id);
      const result = await getSlideViewUrl(lesson.slide_id);
      setLoadingSlideId(null);
      if (result.error) {
        setSlideErrors((e) => ({ ...e, [lesson.id]: result.error! }));
      } else if (result.url) {
        setSlideUrls((u) => ({ ...u, [lesson.id]: result.url! }));
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {lessons.map((lesson, i) => {
        const isExpanded = expandedId === lesson.id;
        return (
          <div key={lesson.id} className="rounded-lg border border-line">
            <button
              type="button"
              onClick={() => toggle(lesson)}
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
                    {loadingSlideId === lesson.id && (
                      <p className="text-xs text-ink-faint">Loading slide…</p>
                    )}
                    {slideErrors[lesson.id] && (
                      <p className="text-xs text-danger">{slideErrors[lesson.id]}</p>
                    )}
                    {slideUrls[lesson.id] && (
                      <div className="h-[28rem] rounded-md bg-black">
                        <WsiViewer imageUrl={slideUrls[lesson.id]} />
                      </div>
                    )}
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
