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
        className="fixed bottom-6 right-6 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
      >
        Ask the AI Tutor
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 flex h-[28rem] w-80 flex-col rounded-lg border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <p className="text-sm font-medium">AI Tutor</p>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-500">
            Ask about a cell type, feature, or module and I&apos;ll answer from the
            HemoEdge library.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <p
              className={
                m.role === "user"
                  ? "inline-block rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white"
                  : "inline-block rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800"
              }
            >
              {m.text}
            </p>
            {m.sources && m.sources.length > 0 && (
              <p className="mt-1 text-[11px] text-neutral-400">
                Sources: {m.sources.join(", ")}
              </p>
            )}
          </div>
        ))}
        {pending && <p className="text-xs text-neutral-400">Thinking…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <form onSubmit={ask} className="flex gap-1 border-t border-neutral-200 p-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
