export type Answer = { optionIds: string[]; booleanValue: boolean | null; numericValue: string | null };
export type AnswerState = { questionId: string; answer: Answer; markedForReview: boolean; revision: number; activeTimeMs: number | null; savedAt: string | null };
export type Question = { id: string; type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC_ANSWER"; content: string; options: { id: string; content: string }[]; state: AnswerState };
export type Attempt = { id: string; sessionId: string; examVersionId: string; title: string; attemptNumber: number; status: string; startedAt: string; deadline: string; serverTime: string; canEdit: boolean; questions: Question[]; completionReason: "PARTICIPANT_SUBMIT" | "DEADLINE_REACHED" | null; submittedAt: string | null; gradedAt: string | null };
export type Save = { revision: number; answer: Answer; markedForReview: boolean; activeTimeMs: number | null };
export type Saved = { state: AnswerState; serverTime: string };
export const emptyAnswer = (): Answer => ({ optionIds: [], booleanValue: null, numericValue: null });
export const answered = (a: Answer) => a.optionIds.length > 0 || a.booleanValue !== null || (a.numericValue !== null && a.numericValue !== "");
export function sameContent(a: Pick<AnswerState, "answer" | "markedForReview">, b: Pick<AnswerState, "answer" | "markedForReview">) {
  return a.markedForReview === b.markedForReview && a.answer.booleanValue === b.answer.booleanValue && a.answer.numericValue === b.answer.numericValue &&
    [...a.answer.optionIds].sort().join() === [...b.answer.optionIds].sort().join();
}
