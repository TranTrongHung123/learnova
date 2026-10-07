import { describe, expect, it } from "vitest";
import { notificationTarget, type NotificationType } from "./types";
const id = "ce9969c2-e127-4779-9266-1a158e1da79f";
describe("notification deep links", () => {
  it.each([
    ["EXAM_ASSIGNED", `/participant/exams/${id}`], ["EXAM_REMINDER", `/participant/exams/${id}`],
    ["RESULT_RELEASED", `/participant/results/${id}`], ["CLASS_JOINED", "/participant/classes"], ["CLASS_JOINED", `/creator/classes/${id}`],
  ])("allows the route for %s", (type, targetPath) => expect(notificationTarget({ type: type as NotificationType, targetPath })).toBe(targetPath));
  it.each(["https://evil.test", "//evil.test", "javascript:alert(1)", "/participant/exams/../profile", `/participant/exams/${id}?next=//evil.test`, `/creator/classes/${id}`, `/participant/results/${id}`, `/participant/exams/${id}#fragment`])("rejects arbitrary or mismatched links %s", targetPath => {
    expect(notificationTarget({ type: "EXAM_ASSIGNED", targetPath })).toBeNull();
  });
});
