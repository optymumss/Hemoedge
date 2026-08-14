"use client";

import { AnnotatedSlideViewer } from "@/components/annotated-slide-viewer";

export function CaseSlideViewer({ slideId }: { slideId: string }) {
  return <AnnotatedSlideViewer slideId={slideId} heightClassName="h-[32rem]" />;
}
