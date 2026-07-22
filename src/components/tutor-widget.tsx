"use client";

import { useState } from "react";

type ChatMessage = { role: "user" | "assistant"; text: string; sources?: string[] };

export function TutorWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.answer, sources: data.sources },
        ]);
      }
    } catch {
      setError("Couldn't reach the AI Tutor.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-ink shadow-lg"
      >
        Ask the AI Tutor
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 flex h-[28rem] w-80 flex-col rounded-lg border border-line bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-sm font-medium">AI Tutor</p>
        <button onClick={() => setOpen(false)} className="text-sm text-ink-dim">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-xs text-ink-dim">
            Ask about a cell type, feature, or module and I&apos;ll answer from the
            HemoEdge library.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <p
              className={
                m.role === "user"
                  ? "inline-block rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-ink"
                  : "inline-block rounded-lg bg-surface-sunken px-3 py-1.5 text-sm text-ink"
              }
            >
              {m.text}
            </p>
            {m.sources && m.sources.length > 0 && (
              <p className="mt-1 text-[11px] text-ink-faint">
                Sources: {m.sources.join(", ")}
              </p>
            )}
          </div>
        ))}
        {pending && <p className="text-xs text-ink-faint">Thinking…</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <form onSubmit={ask} className="flex gap-1 border-t border-line p-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Ask the AI Tutor a question"
          className="flex-1 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
