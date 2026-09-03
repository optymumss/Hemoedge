"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { computeAttempt } from "@/lib/quiz/score-attempt";
import { gradeCaseReport } from "@/lib/case-report/grade-report";

export type FormState = { error?: string } | undefined;

const ESCALATION_DECISIONS = ["routine", "senior_review", "urgent"];

export type SubmitReportResult =
  | {
      score: number;
      missedFindings: string[];
      feedback: string;
      escalationCorrect: boolean;
      correctEscalationDecision: string | null;
      suggestedReportComment: string | null;
    }
  | { error: string };

export async function submitCaseReport(
  caseId: string,
  fields: {
    rbcMorphology: string;
    wbcMorphology: string;
    plateletMorphology: string;
    abnormalFindings: string;
    overallInterpretation: string;
    escalationDecision: string;
    reportComment: string;
  },
): Promise<SubmitReportResult> {
  if (await getActiveImpersonation()) {
    return { error: "Submitting is disabled while viewing as another user." };
  }

  const trimmed = {
    rbcMorphology: fields.rbcMorphology.trim(),
    wbcMorphology: fields.wbcMorphology.trim(),
    plateletMorphology: fields.plateletMorphology.trim(),
    abnormalFindings: fields.abnormalFindings.trim(),
    overallInterpretation: fields.overallInterpretation.trim(),
    reportComment: fields.reportComment.trim(),
  };
  if (Object.values(trimmed).some((v) => v === "")) {
    return { error: "Every section is required before submitting." };
  }
  if (!ESCALATION_DECISIONS.includes(fields.escalationDecision)) {
    return { error: "Choose an escalation decision." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: case_ } = await supabase
    .from("cases")
    .select(
      "final_diagnosis, expected_rbc_findings, expected_wbc_findings, expected_platelet_findings, expected_abnormal_findings, critical_findings, learning_points, suggested_report_comment, escalation_decision",
    )
    .eq("id", caseId)
    .single();

  if (!case_) return { error: "Case not found." };

  const escalationCorrect = fields.escalationDecision === case_.escalation_decision;

  const graded = await gradeCaseReport(
    {
      finalDiagnosis: case_.final_diagnosis,
      expectedRbcFindings: case_.expected_rbc_findings,
      expectedWbcFindings: case_.expected_wbc_findings,
      expectedPlateletFindings: case_.expected_platelet_findings,
      expectedAbnormalFindings: case_.expected_abnormal_findings,
      criticalFindings: case_.critical_findings,
      learningPoints: case_.learning_points,
      suggestedReportComment: case_.suggested_report_comment,
    },
    { ...trimmed, escalationDecision: fields.escalationDecision },
  );

  if ("error" in graded) return graded;

  const { error } = await supabase.from("case_report_submissions").insert({
    case_id: caseId,
    user_id: user.id,
    rbc_morphology: trimmed.rbcMorphology,
    wbc_morphology: trimmed.wbcMorphology,
    platelet_morphology: trimmed.plateletMorphology,
    abnormal_findings: trimmed.abnormalFindings,
    overall_interpretation: trimmed.overallInterpretation,
    escalation_decision: fields.escalationDecision,
    report_comment: trimmed.reportComment,
    ai_score: graded.score,
    ai_missed_findings: graded.missedFindings,
    ai_feedback: graded.feedback,
    escalation_correct: escalationCorrect,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/cases/${caseId}`);
  return {
    ...graded,
    escalationCorrect,
    correctEscalationDecision: case_.escalation_decision,
    suggestedReportComment: case_.suggested_report_comment,
  };
}

export async function submitQuizAttempt(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const caseId = String(formData.get("case_id") ?? "");
  if (!caseId) return { error: "Missing case." };

  if (await getActiveImpersonation()) {
    return { error: "Quiz submission is disabled while viewing as another user." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_type, correct_choice_id, correct_choice_ids")
    .eq("case_id", caseId);

  if (!questions || questions.length === 0) {
    return { error: "No questions to score." };
  }

  const { answers, score, passed, pendingManualGrading } = computeAttempt(questions, formData);

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    case_id: caseId,
    score,
    passed,
    answers,
    pending_manual_grading: pendingManualGrading,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/cases/${caseId}`);
  return undefined;
}
