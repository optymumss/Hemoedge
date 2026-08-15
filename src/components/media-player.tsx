/** Plain native controls, no autoplay — narration and video demonstrations
 * are supplementary, so playback should always be a deliberate click, never
 * something that starts talking or moving on page load. Rendered alongside
 * the WSI viewer rather than inside it, since the two are independent: a
 * learner can pan/zoom a slide while the narration plays. */
export function MediaPlayer({
  audioUrl,
  audioTranscript,
  videoUrl,
}: {
  audioUrl?: string | null;
  audioTranscript?: string | null;
  videoUrl?: string | null;
}) {
  if (!audioUrl && !videoUrl) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      {videoUrl && (
        <div>
          <p className="text-xs font-medium uppercase text-ink-faint">Video</p>
          <video controls className="mt-1 w-full rounded-md" src={videoUrl} />
        </div>
      )}
      {audioUrl && (
        <div>
          <p className="text-xs font-medium uppercase text-ink-faint">Audio narration</p>
          <audio controls className="mt-1 w-full" src={audioUrl} />
          {audioTranscript && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ink-dim">Transcript</summary>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{audioTranscript}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
