import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { retrieveContext } from "@/lib/tutor/retrieve-context";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The AI Tutor isn't configured yet — ask an admin to set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const snippets = await retrieveContext(question);
  const context = snippets.length
    ? snippets.map((s) => `[${s.source}: ${s.title}]\n${s.text}`).join("\n\n")
    : "No matching material was found in the HemoEdge library for this question.";

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are the HemoEdge AI Tutor, helping laboratory professionals learn blood cell morphology. Answer using the reference material below when it's relevant; if it doesn't cover the question, say so and answer from general hematology knowledge. Keep answers concise and precise.\n\nReference material:\n${context}`,
      messages: [{ role: "user", content: question }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({ answer: text, sources: snippets.map((s) => s.title) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    }
    return NextResponse.json({ error: "The AI Tutor is unavailable right now." }, { status: 500 });
  }
}
