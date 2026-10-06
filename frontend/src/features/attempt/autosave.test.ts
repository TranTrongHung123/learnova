import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { Autosave } from "./autosave";
import { emptyAnswer, type AnswerState, type Attempt, type Save, type Saved } from "./types";

const state = (revision = 0, numericValue: string | null = null): AnswerState => ({ questionId: "q", revision, answer: { ...emptyAnswer(), numericValue }, markedForReview: false, activeTimeMs: null, savedAt: null });
const view = (s = state()): Attempt => ({ id: "a", sessionId: "s", examVersionId: "v", title: "Exam", attemptNumber: 1, status: "IN_PROGRESS", completionReason: null, submittedAt: null, gradedAt: null, startedAt: "2026-01-01T00:00:00Z", serverTime: "2026-01-01T00:00:10Z", deadline: "2026-01-01T01:00:00Z", canEdit: true, questions: [{ id: "q", type: "NUMERIC_ANSWER", content: "Number", options: [], state: s }] });
const conflict = () => new ApiError("http", 409, { status: 409, code: "ANSWER_REVISION_CONFLICT", type: "about:blank", title: "Conflict", detail: "Conflict", instance: "/", fieldErrors: [] });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
async function setup(save: (id: string, input: Save) => Promise<Saved>, read = vi.fn(async () => view()), submit = vi.fn(async () => completed())) {
  const engine = new Autosave({ save, read, submit }, () => 0); engine.connect(); await Promise.resolve(); await Promise.resolve(); return { engine, read, submit };
}
const completed = (): Attempt => ({ ...view(), status: "GRADED", canEdit: false, questions: [], completionReason: "PARTICIPANT_SUBMIT", submittedAt: view().serverTime, gradedAt: view().serverTime });
describe("autosave reliability", () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it("waits for the in-flight save and the newer coalesced answer before submitting once", async () => {
    const first = deferred<Saved>(), second = deferred<Saved>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { engine, submit } = await setup(save);
    engine.edit("q", { answer: state(0, "1").answer }); await vi.advanceTimersByTimeAsync(1);
    engine.edit("q", { answer: state(0, "2").answer }, true);
    const sending = engine.submit(); await engine.submit();
    expect(engine.editable()).toBe(false); expect(submit).not.toHaveBeenCalled();
    first.resolve({ state: state(1, "1"), serverTime: view().serverTime }); await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2); expect(submit).not.toHaveBeenCalled();
    expect(save.mock.calls[1][1].answer.numericValue).toBe("2");
    second.resolve({ state: state(2, "2"), serverTime: view().serverTime }); await sending;
    expect(submit).toHaveBeenCalledTimes(1); expect(engine.getSnapshot().submission).toBe("complete");
  });
  it("does not submit if saving fails or needs conflict resolution", async () => {
    for (const error of [new ApiError("network", 0), conflict()]) {
      const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(view(state(1, "9")));
      const { engine, submit } = await setup(vi.fn().mockRejectedValue(error), read);
      engine.edit("q", { answer: state(0, "1").answer }, true); await engine.submit();
      expect(submit).not.toHaveBeenCalled(); expect(engine.getSnapshot().submission).toBe("blocked"); expect(engine.editable()).toBe(true);
    }
  });
  it("recovers a lost submit response through authoritative read", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(completed());
    const { engine, submit } = await setup(vi.fn(), read, vi.fn().mockRejectedValue(new Error("Timeout")));
    await engine.submit(); expect(read).toHaveBeenCalledTimes(2); expect(submit).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().submission).toBe("complete");
  });
  it("keeps an uncertain submit locked until state can be checked", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(view());
    const { engine, submit } = await setup(vi.fn(), read, vi.fn().mockRejectedValue(new Error("Timeout")));
    await engine.submit(); expect(engine.getSnapshot().submission).toBe("unknown"); expect(engine.editable()).toBe(false);
    await engine.submit(); expect(submit).toHaveBeenCalledTimes(1);
    await engine.checkSubmission(); expect(engine.getSnapshot().submission).toBe("blocked"); expect(engine.editable()).toBe(true);
  });
  it("does not regress a completed attempt when an older read returns", async () => {
    const old = deferred<Attempt>();
    const read = vi.fn().mockResolvedValueOnce(view()).mockReturnValueOnce(old.promise);
    const { engine } = await setup(vi.fn(), read);
    const refresh = engine.refresh(); await engine.submit(); old.resolve(view()); await refresh;
    expect(engine.getSnapshot().attempt?.status).toBe("GRADED"); expect(engine.editable()).toBe(false);
  });
  it("does not submit after the last save discovers expiration", async () => {
    const expired = { ...completed(), completionReason: "DEADLINE_REACHED" as const };
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(expired);
    const { engine, submit } = await setup(vi.fn().mockRejectedValue(new ApiError("http", 409)), read);
    engine.edit("q", { answer: state(0, "2").answer }, true); await engine.submit(); await vi.advanceTimersByTimeAsync(1);
    expect(submit).not.toHaveBeenCalled(); expect(engine.getSnapshot().submission).toBe("complete");
  });
  it("serializes and coalesces changes without marking a newer input Saved", async () => {
    const first = deferred<Saved>(), second = deferred<Saved>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { engine } = await setup(save);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }); await vi.advanceTimersByTimeAsync(0);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "2" } });
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "3" } }); await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ state: state(1, "1"), serverTime: view().serverTime }); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q.local.answer.numericValue).toBe("3");
    expect(engine.getSnapshot().drafts.q.status).not.toBe("saved"); expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toMatchObject({ revision: 1, answer: { numericValue: "3" } });
    second.resolve({ state: state(2, "3"), serverTime: view().serverTime }); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q.status).toBe("saved");
  });
  it("keeps failed input and bounds automatic retries", async () => {
    const save = vi.fn().mockRejectedValue(new ApiError("network", 0)); const { engine } = await setup(save);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }); await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(4); expect(engine.getSnapshot().drafts.q.status).toBe("failed"); expect(engine.hasUnsaved()).toBe(true);
    expect(save.mock.calls.every(call => call[1].revision === 0)).toBe(true);
  });
  it("recognizes committed saves with lost responses without duplicating telemetry", async () => {
    const committed = { ...state(1, "1"), activeTimeMs: 5000 };
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(view(committed));
    const save = vi.fn().mockRejectedValueOnce(new ApiError("network", 0)).mockRejectedValueOnce(conflict());
    const { engine } = await setup(save, read);
    engine.edit("q", { answer: committed.answer, activeTimeMs: 5000 }); await vi.advanceTimersByTimeAsync(1500);
    expect(engine.getSnapshot().drafts.q.status).toBe("saved"); expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][1]).toEqual(save.mock.calls[1][1]);
  });
  it("preserves both versions until an explicit conflict choice", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(view(state(1, "9")));
    const save = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValue({ state: state(2, "1"), serverTime: view().serverTime });
    const { engine } = await setup(save, read);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q).toMatchObject({ status: "conflict", local: { answer: { numericValue: "1" } }, conflict: { answer: { numericValue: "9" } } });
    await vi.advanceTimersByTimeAsync(10000); expect(save).toHaveBeenCalledTimes(1);
    engine.resolve("q", true); await vi.advanceTimersByTimeAsync(1);
    expect(save.mock.calls[1][1].revision).toBe(1); expect(engine.getSnapshot().drafts.q.status).toBe("saved");
  });
  it("can discard local input for the server version without another write", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(view(state(1, "9"))); const save = vi.fn().mockRejectedValue(conflict());
    const { engine } = await setup(save, read); engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }); await vi.advanceTimersByTimeAsync(1);
    engine.resolve("q", false); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q.local.answer.numericValue).toBe("9"); expect(save).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite dirty input on refetch and stops after authoritative expiry", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValueOnce(view(state(1, "9"))).mockResolvedValue({ ...view(), canEdit: false, questions: [] });
    const save = vi.fn(); const { engine } = await setup(save, read);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }, true); await engine.refresh();
    expect(engine.getSnapshot().drafts.q.local.answer.numericValue).toBe("1"); await engine.refresh(); await vi.advanceTimersByTimeAsync(1000);
    expect(engine.editable()).toBe(false); expect(save).not.toHaveBeenCalled(); expect(engine.hasUnsaved()).toBe(true);
  });
  it("accepts bounded telemetry acknowledged by server without an endless save loop", async () => {
    const save = vi.fn().mockResolvedValue({ state: { ...state(1), activeTimeMs: 1000 }, serverTime: view().serverTime });
    const { engine } = await setup(save); engine.telemetry("q", 2000); await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(1); expect(engine.getSnapshot().drafts.q.status).toBe("saved");
  });
  it("accepts server-capped telemetry after a lost response without a false conflict", async () => {
    const committed = { ...state(1, "1"), activeTimeMs: 1000 };
    const read = vi.fn().mockResolvedValueOnce(view()).mockResolvedValue(view(committed));
    const save = vi.fn().mockRejectedValueOnce(new ApiError("network", 0)).mockRejectedValueOnce(conflict());
    const { engine } = await setup(save, read);
    engine.edit("q", { answer: committed.answer, activeTimeMs: 2000 }); await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().drafts.q).toMatchObject({ status: "saved", local: { activeTimeMs: 1000 }, conflict: undefined });
  });
  it("retains input and telemetry added while reconciling a capped save", async () => {
    const reconcile = deferred<Attempt>(), next = deferred<Saved>();
    const read = vi.fn().mockResolvedValueOnce(view()).mockReturnValueOnce(reconcile.promise);
    const save = vi.fn().mockRejectedValueOnce(new ApiError("network", 0)).mockRejectedValueOnce(conflict()).mockReturnValueOnce(next.promise);
    const { engine } = await setup(save, read);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" }, activeTimeMs: 2000 }); await vi.advanceTimersByTimeAsync(1500);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "2" }, activeTimeMs: 2500 });
    reconcile.resolve(view({ ...state(1, "1"), activeTimeMs: 1000 })); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q.local.answer.numericValue).toBe("2");
    expect(engine.getSnapshot().drafts.q.status).not.toBe("saved");
    expect(save.mock.calls[2][1]).toMatchObject({ revision: 1, answer: { numericValue: "2" }, activeTimeMs: 2500 });
    next.resolve({ state: { ...state(2, "2"), activeTimeMs: 1500 }, serverTime: view().serverTime }); await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().drafts.q.status).toBe("saved");
  });
  it.each([[403, "forbidden"], [404, "not-found"], [503, "error"]] as const)("classifies HTTP %s as %s instead of a connection error", async (status, kind) => {
    const read = vi.fn().mockRejectedValue(new ApiError("http", status)); const { engine } = await setup(vi.fn(), read);
    expect(engine.getSnapshot().errorKind).toBe(kind); expect(engine.editable()).toBe(false);
  });
  it("distinguishes connection failures and clears the error after recovery", async () => {
    const read = vi.fn().mockRejectedValueOnce(new ApiError("network", 0)).mockResolvedValue(view());
    const { engine } = await setup(vi.fn(), read); expect(engine.getSnapshot().errorKind).toBe("network");
    await engine.refresh(); expect(engine.getSnapshot().errorKind).toBeUndefined(); expect(engine.editable()).toBe(true);
  });
  it("retains unsaved input but disables editing when access is revoked on refetch", async () => {
    const read = vi.fn().mockResolvedValueOnce(view()).mockRejectedValueOnce(new ApiError("http", 403));
    const save = vi.fn(); const { engine } = await setup(save, read);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "3" } }, true);
    await engine.refresh(); await vi.advanceTimersByTimeAsync(1000);
    expect(engine.getSnapshot().drafts.q.local.answer.numericValue).toBe("3"); expect(engine.editable()).toBe(false); expect(save).not.toHaveBeenCalled();
  });
  it("does not retry validation failures on focus or telemetry until the answer changes", async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApiError("http", 400)).mockResolvedValueOnce({ state: state(1, "3"), serverTime: view().serverTime });
    const { engine } = await setup(save); engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "-" } }); await vi.advanceTimersByTimeAsync(1);
    engine.telemetry("q", 15000); engine.retry("q", true); await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(1); expect(engine.getSnapshot().drafts.q.status).toBe("failed");
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "3" } }); await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2); expect(engine.getSnapshot().drafts.q.status).toBe("saved");
  });
  it("does not use telemetry to restart exhausted network retries", async () => {
    const save = vi.fn().mockRejectedValue(new ApiError("network", 0)); const { engine } = await setup(save);
    engine.edit("q", { answer: { ...emptyAnswer(), numericValue: "1" } }); await vi.advanceTimersByTimeAsync(10000);
    engine.telemetry("q", 15000); await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(4); expect(engine.getSnapshot().drafts.q.status).toBe("failed");
  });
});
