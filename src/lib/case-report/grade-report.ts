import Anthropic from "@anthropic-ai/sdk";

export type CaseAnswerKey = {
  finalDiagnosis: string | null;
  expectedRbcFindings: string | null;
  expectedWbcFindings: string | null;
  expectedPlateletFindings: string | null;
  expectedAbnormalFindings: string | null;
  criticalFindings: string | null;
  learningPoints: string | null;
  suggestedReportComment: string | null;
};

export type ReportSubmission = {
  rbcMorphology: string;
  wbcMorphology: string;
  plateletMorphology: string;
  abnormalFindings: string;
  overallInterpretation: string;
  escalationDecision: string;
  reportComment: string;
};

export type GradeResult =
  | { score: number; missedFindings: string[]; feedback: string }
  | { error: string };

function answerKeyLine(label: string, value: string | null): string {
  return `${label}: ${value?.trim() || "(not specified by the case author)"}`;
}

/**
 * Grades a learner's structured blood film report against this specific
 * case's answer key — not general haematology knowledge. Reuses the same
 * Anthropic SDK setup as the AI Tutor (src/app/api/tutor/route.ts); the
 * only difference is the prompt asks for a strict-JSON grading verdict
 * instead of a conversational answer.
 */
export async function gradeCaseReport(
  answerKey: CaseAnswerKey,
  submission: ReportSubmission,
): Promise<GradeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI grading isn't configured yet — ask an admin to set ANTHROPIC_API_KEY." };
  }

  const answerKeyText = [
    answerKeyLine("Final diagnosis", answerKey.finalDiagnosis),
    answerKeyLine("Expected RBC morphology findings", answerKey.expectedRbcFindings),
    answerKeyLine("Expected WBC morphology findings", answerKey.expectedWbcFindings),
    answerKeyLine("Expected platelet morphology findings", answerKey.expectedPlateletFindings),
    answerKeyLine("Expected abnormal cells/parasites/flags", answerKey.expectedAbnormalFindings),
    answerKeyLine("Critical findings (must not be missed)", answerKey.criticalFindings),
    answerKeyLine("Key learning points", answerKey.learningPoints),
    answerKeyLine("Expert suggested report comment", answerKey.suggestedReportComment),
  ].join("\n");

  const submissionText = [
    `RBC morphology: ${submission.rbcMorphology}`,
    `WBC morphology: ${submission.wbcMorphology}`,
    `Platelet morphology: ${submission.plateletMorphology}`,
    `Abnormal cells/parasites/flags: ${submission.abnormalFindings}`,
    `Overall interpretation: ${submission.overallInterpretation}`,
    `Escalation decision: ${submission.escalationDecision}`,
    `Suggested report comment: ${submission.reportComment}`,
  ].join("\n");

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system:
        "You are a consultant haematologist grading a trainee's structured blood film report " +
        "for one specific case. The escalation decision is shown for context only and is graded " +
        "separately elsewhere — do not factor it into your score. Grade the trainee's submission " +
        "strictly against THIS case's " +
        "answer key below — not general haematology knowledge, and not morphology facts the " +
        "case author didn't specify. Missing a critical finding should weigh heavily on the " +
        "score. Reply with ONLY a JSON object, no markdown fences, no other text, matching " +
        'exactly this shape: {"score": <integer 0-100>, "missedFindings": [<short strings>], ' +
        '"feedback": "<2-4 sentences of constructive feedback>"}.',
      messages: [
        {
          role: "user",
          content: `Case answer key:\n${answerKeyText}\n\nTrainee's submission:\n${submissionText}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonText) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).score !== "number" ||
      !Array.isArray((parsed as Record<string, unknown>).missedFindings) ||
      typeof (parsed as Record<string, unknown>).feedback !== "string"
    ) {
      return { error: "AI grading returned an unexpected response. Please try again." };
    }

    const result = parsed as { score: number; missedFindings: unknown[]; feedback: string };
    const score = Math.max(0, Math.min(100, Math.round(result.score)));
    const missedFindings = result.missedFindings.filter((f): f is string => typeof f === "string");

    return { score, missedFindings, feedback: result.feedback };
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
