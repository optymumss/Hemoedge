export interface SlideProgress {
  completed: number;
  total: number;
  percent: number;
}

/** How far a learner has gotten through a module's slides, for the
 * "Continue Learning" card's progress bar. Pure — the caller resolves
 * which slide_ids belong to the module's lessons and which of those the
 * learner has viewed. */
export function computeSlideProgress(lessonSlideIds: string[], viewedSlideIds: Set<string>): SlideProgress {
  const total = lessonSlideIds.length;
  const completed = lessonSlideIds.filter((id) => viewedSlideIds.has(id)).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
