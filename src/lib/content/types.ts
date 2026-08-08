export const CONTENT_TABLES = {
  slide: "slides",
  feature: "features",
  module: "modules",
  case: "cases",
  curriculum: "curricula",
  wbc_diff_exercise: "wbc_diff_exercises",
} as const;

export type ContentType = keyof typeof CONTENT_TABLES;

// Display labels for content types that read differently to users than
// their internal discriminator string (e.g. "curriculum" stays the table
// name and content_type value everywhere, but shows as "Learning Pathway").
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  slide: "Slide",
  feature: "Feature",
  module: "Module",
  case: "Case Study",
  curriculum: "Learning Pathway",
  wbc_diff_exercise: "WBC Diff Exercise",
};
