import Anthropic from "@anthropic-ai/sdk";

export type ShortAnswerItem = {
  id: string;
  questionText: string;
  modelAnswer: string;
  submitted: string;
};

export type GradeShortAnswersResult = { grades: Record<string, boolean> } | { error: string };

/**
 * Grades free-text quiz answers against each question's model answer,
 * replacing the manual Grading Queue. Reuses the same Anthropic SDK setup as
 * the AI Tutor (src/app/api/tutor/route.ts) and the case report grader
 * (src/lib/case-report/grade-report.ts) — a strict-JSON verdict instead of a
 * conversational answer. Graded in one batched call rather than one per
 * question, since a quiz attempt is usually only a handful of questions.
 */
export async function gradeShortAnswers(items: ShortAnswerItem[]): Promise<GradeShortAnswersResult> {
  if (items.length === 0) return { grades: {} };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI grading isn't configured yet — ask an admin to set ANTHROPIC_API_KEY." };
  }

  const questionsText = items
    .map(
      (item, i) =>
        `${i + 1}. id: ${item.id}\nQuestion: ${item.questionText}\nModel answer: ${item.modelAnswer}\nLearner's answer: ${item.submitted || "(no answer)"}`,
    )
    .join("\n\n");

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system:
        "You are grading a learner's free-text quiz answers against each question's model answer. " +
        "Accept reasonable synonyms, paraphrasing, and partial phrasing that captures the same " +
        "clinical meaning as the model answer — don't require an exact word match. Grade each " +
        "question independently. Reply with ONLY a JSON object, no markdown fences, no other text, " +
        'matching exactly this shape: {"grades": {"<question id>": <true or false>, ...}} with one ' +
        "entry for every question id given.",
      messages: [{ role: "user", content: questionsText }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonText) as unknown;

    const grades = (parsed as Record<string, unknown> | null)?.grades;
    if (typeof grades !== "object" || grades === null) {
      return { error: "AI grading returned an unexpected response. Please try again." };
    }

    const result: Record<string, boolean> = {};
    for (const item of items) {
      result[item.id] = (grades as Record<string, unknown>)[item.id] === true;
    }

    return { grades: result };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return { error: `AI grading is unavailable right now: ${error.message}` };
    }
    if (error instanceof SyntaxError) {
      return { error: "AI grading returned an unexpected response. Please try again." };
    }
    return { error: "AI grading is unavailable right now. Please try again." };
  }
}
