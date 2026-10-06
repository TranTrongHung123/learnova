import { describe, expect, it } from "vitest";
import { applyFrame, type Frame, type Participant } from "./types";
const row: Participant = { participantId: "p", displayName: "Participant", attemptId: "a", attemptNumber: 1, status: "IN_PROGRESS", answeredCount: 0, totalQuestions: 2, connectionStatus: "CONNECTED" };
const sync: Frame = { type: "SYNC", streamId: "s", sequence: 1, sessionId: "exam", title: "Exam", sessionStatus: "OPEN", accessType: "PUBLIC", serverTime: "2026-10-06T00:00:00Z", summary: { total: 1, inProgress: 1, submitted: 0, disconnected: 0 }, changes: [{ type: "STARTED", participant: row }], removedParticipantIds: [] };
describe("monitoring reconciliation", () => {
  it("ignores duplicate and out-of-order events after completion", () => {
    const first = applyFrame(undefined, sync);
    const completed = applyFrame(first, { ...sync, type: "DELTA", sequence: 2, changes: [{ type: "SUBMITTED", participant: { ...row, status: "GRADED" } }] });
    expect(applyFrame(completed, sync)).toBe(completed);
    expect(applyFrame(completed, { ...sync, type: "DELTA", sequence: 2 })).toBe(completed);
    expect(completed.snapshot.participants[0].status).toBe("GRADED");
  });
  it("detects gaps and foreign streams instead of accepting incomplete progress", () => {
    const state = applyFrame(undefined, sync);
    expect(() => applyFrame(state, { ...sync, type: "DELTA", sequence: 3 })).toThrow();
    expect(() => applyFrame(state, { ...sync, type: "DELTA", sequence: 2, streamId: "old" })).toThrow();
    expect(() => applyFrame(state, { ...sync, type: "DELTA", sequence: 2, sessionId: "other" })).toThrow();
  });
  it("reconnect sync replaces stale roster and preserves clearing answers", () => {
    const old = applyFrame(undefined, sync);
    const answered = applyFrame(old, { ...sync, type: "DELTA", sequence: 2, changes: [{ type: "PROGRESS", participant: { ...row, answeredCount: 2 } }] });
    const cleared = applyFrame(answered, { ...sync, type: "DELTA", sequence: 3 });
    expect(cleared.snapshot.participants[0].answeredCount).toBe(0);
    const removed = applyFrame(cleared, { ...sync, type: "DELTA", sequence: 4, changes: [], removedParticipantIds: ["p"] });
    expect(removed.snapshot.participants).toEqual([]);
    expect(applyFrame(undefined, { ...sync, streamId: "new", changes: [] }).snapshot.participants).toEqual([]);
  });
  it("connection loss does not finalize an attempt", () => {
    const state = applyFrame(applyFrame(undefined, sync), { ...sync, type: "DELTA", sequence: 2, changes: [{ type: "DISCONNECTED", participant: { ...row, connectionStatus: "DISCONNECTED" } }] });
    expect(state.snapshot.participants[0].status).toBe("IN_PROGRESS");
  });
});
