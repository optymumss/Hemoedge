export const CONTENT_TABLES = {
  slide: "slides",
  feature: "features",
  module: "modules",
  case: "cases",
  curriculum: "curricula",
} as const;

export type ContentType = keyof typeof CONTENT_TABLES;
