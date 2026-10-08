import { ApiError } from "@/lib/api/client";
import { sameContent, type AnswerState, type Attempt, type Save, type Saved } from "./types";

export type Draft = {
  local: AnswerState;
  saved: AnswerState;
  status: "saved" | "dirty" | "saving" | "failed" | "conflict";
  generation: number;
  conflict?: AnswerState;
  error?: string;
};

type LoadErrorKind = "forbidden" | "not-found" | "network" | "error";

type Submission =
  "idle" | "saving" | "submitting" | "checking" | "unknown" | "blocked" | "complete";

type Snapshot = {
  attempt?: Attempt;
  drafts: Record<string, Draft>;
  error?: string;
  errorKind?: LoadErrorKind;
  remaining: number;
  submission: Submission;
  submissionError?: string;
};

type Transport = {
  read: () => Promise<Attempt>;
  save: (id: string, input: Save) => Promise<Saved>;
  submit: () => Promise<Attempt>;
};

// Queue riêng từng câu; revision của máy chủ bảo vệ cả khi có nhiều tab.
export class Autosave {
  private snapshot: Snapshot = { drafts: {}, remaining: 0, submission: "idle" };
  private flights = new Map<string, Promise<void>>();
  private listeners = new Set<() => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private sending = new Set<string>();
  private failures = new Map<string, number>();
  private automaticRetryBlocked = new Set<string>();
  private pending = new Map<string, Save>();
  private anchor = { server: 0, local: 0 };
  private epoch = 0;
  private reading = false;
  private active = false;
  constructor(
    private transport: Transport,
    private now = () => performance.now(),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private emit() {
    this.snapshot = { ...this.snapshot, drafts: { ...this.snapshot.drafts } };
    this.listeners.forEach((l) => l());
  }
  connect() {
    this.active = true;
    void this.refresh();
    return () => this.disconnect();
  }
  private disconnect() {
    this.active = false;
    this.epoch++;
    this.reading = false;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.sending.clear();
    this.flights.clear();
  }
  private sync(serverTime: string) {
    const local = this.now();
    const prior = this.anchor.server ? this.anchor.server + local - this.anchor.local : 0;
    this.anchor = { server: Math.max(Date.parse(serverTime), prior), local };
  }
  private acceptAttempt(a: Attempt) {
    // Response cũ từ tab/save/read không được mở lại bài đã hoàn tất.
    if (
      this.snapshot.attempt &&
      this.snapshot.attempt.status !== "IN_PROGRESS" &&
      a.status === "IN_PROGRESS"
    )
      return;
    this.snapshot.attempt = a;
    this.sync(a.serverTime);
    if (a.status !== "IN_PROGRESS") {
      this.snapshot.submission = "complete";
      this.snapshot.submissionError = undefined;
      this.timers.forEach(clearTimeout);
      this.timers.clear();
      this.pending.clear();
    }
  }
  tick() {
    const a = this.snapshot.attempt;
    if (!a) return;
    const before = this.snapshot.remaining;
    this.snapshot.remaining = Math.max(
      0,
      Math.ceil(
        (Date.parse(a.deadline) - this.anchor.server - (this.now() - this.anchor.local)) / 1000,
      ),
    );
    this.emit();
    if (before > 0 && this.snapshot.remaining === 0) void this.refresh();
  }
  async refresh() {
    if (!this.active || this.reading) return;
    const epoch = this.epoch;
    this.reading = true;
    try {
      const a = await this.transport.read();
      if (!this.active || epoch !== this.epoch) return;
      this.acceptAttempt(a);
      this.snapshot.error = undefined;
      this.snapshot.errorKind = undefined;
      if (this.snapshot.submission === "complete") {
        this.tick();
        return;
      }
      for (const q of a.questions) {
        const d = this.snapshot.drafts[q.id];
        if (
          !d ||
          (d.status === "saved" && !this.sending.has(q.id) && q.state.revision >= d.saved.revision)
        )
          this.snapshot.drafts[q.id] = {
            local: q.state,
            saved: q.state,
            generation: d?.generation ?? 0,
            status: "saved",
          };
      }
      this.tick();
    } catch (error) {
      if (this.active && epoch === this.epoch) {
        const kind: LoadErrorKind =
          error instanceof ApiError && error.status === 403
            ? "forbidden"
            : error instanceof ApiError && error.status === 404
              ? "not-found"
              : (error instanceof ApiError && error.kind === "network") ||
                  (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
                ? "network"
                : "error";
        const descriptions = {
          forbidden: "Bạn không có quyền truy cập bài làm này.",
          "not-found": "Không tìm thấy bài làm bạn được phép truy cập.",
          network: "Không đồng bộ được với máy chủ. Kiểm tra kết nối và thử lại.",
          error: "Máy chủ chưa thể tải bài làm. Vui lòng thử lại sau.",
        };
        this.snapshot.errorKind = kind;
        this.snapshot.error = descriptions[kind];
        this.emit();
      }
    } finally {
      if (epoch === this.epoch) this.reading = false;
    }
  }
  private canSave() {
    return (
      this.snapshot.errorKind !== "forbidden" &&
      this.snapshot.errorKind !== "not-found" &&
      this.snapshot.attempt?.canEdit === true &&
      this.snapshot.remaining > 0 &&
      ["idle", "blocked", "saving"].includes(this.snapshot.submission)
    );
  }
  editable() {
    return this.canSave() && this.snapshot.submission !== "saving";
  }
  hasUnsaved() {
    return (
      this.snapshot.submission !== "complete" &&
      Object.values(this.snapshot.drafts).some((d) => d.status !== "saved")
    );
  }
  async submit() {
    if (!this.active || !this.editable()) return;
    const epoch = this.epoch;
    this.snapshot.submission = "saving";
    this.snapshot.submissionError = undefined;
    this.emit();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    do {
      await Promise.all(Object.keys(this.snapshot.drafts).map((id) => this.flush(id)));
      if (!this.active || epoch !== this.epoch || this.getSnapshot().submission === "complete")
        return;
      if (!this.canSave()) {
        await this.checkSubmission();
        return;
      }
      if (
        Object.values(this.snapshot.drafts).some((d) => ["failed", "conflict"].includes(d.status))
      ) {
        this.snapshot.submission = "blocked";
        this.snapshot.submissionError =
          "Còn thay đổi chưa lưu hoặc cần đối chiếu. Hãy xử lý trước khi nộp bài.";
        this.emit();
        return;
      }
    } while (this.hasUnsaved());
    this.snapshot.submission = "submitting";
    this.emit();
    try {
      const a = await this.transport.submit();
      if (!this.active || epoch !== this.epoch) return;
      this.acceptAttempt(a);
      if (a.status === "IN_PROGRESS") await this.checkSubmission();
    } catch {
      if (this.active && epoch === this.epoch) await this.checkSubmission();
    } finally {
      if (this.active && epoch === this.epoch) this.emit();
    }
  }
  async checkSubmission() {
    if (
      !this.active ||
      this.snapshot.submission === "complete" ||
      this.snapshot.submission === "checking"
    )
      return;
    const epoch = this.epoch;
    this.snapshot.submission = "checking";
    this.emit();
    try {
      const a = await this.transport.read();
      if (!this.active || epoch !== this.epoch) return;
      this.acceptAttempt(a);
      this.tick();
      if (this.getSnapshot().submission !== "complete") {
        this.snapshot.submission = "blocked";
        this.snapshot.submissionError =
          "Máy chủ chưa xác nhận hoàn tất bài. Bạn có thể kiểm tra và thử lại.";
      }
    } catch {
      if (this.active && epoch === this.epoch && this.getSnapshot().submission !== "complete") {
        this.snapshot.submission = "unknown";
        this.snapshot.submissionError =
          "Chưa xác nhận được trạng thái nộp bài. Kết nối lại để kiểm tra.";
      }
    } finally {
      if (this.active && epoch === this.epoch) this.emit();
    }
  }
  edit(id: string, change: Partial<AnswerState>, debounce = false) {
    if (!this.editable()) return;
    this.automaticRetryBlocked.delete(id);
    const d = this.snapshot.drafts[id];
    this.snapshot.drafts[id] = {
      ...d,
      local: { ...d.local, ...change },
      generation: d.generation + 1,
      status: d.status === "conflict" ? "conflict" : "dirty",
      error: undefined,
    };
    this.emit();
    if (d.status !== "conflict") this.schedule(id, debounce ? 500 : 0);
  }
  telemetry(id: string, milliseconds: number) {
    const d = this.snapshot.drafts[id];
    if (!d || !this.editable() || d.status === "conflict" || d.status === "failed") return;
    this.edit(id, {
      activeTimeMs: (d.local.activeTimeMs ?? 0) + Math.max(0, Math.floor(milliseconds)),
    });
  }
  private schedule(id: string, delay: number) {
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        void this.flush(id);
      }, delay),
    );
  }
  retry(id: string, automatic = false) {
    if (automatic && this.automaticRetryBlocked.has(id)) return;
    this.failures.delete(id);
    void this.flush(id);
  }
  flush(id: string): Promise<void> {
    const current = this.flights.get(id);
    if (current) return current;
    const flight = this.send(id).finally(() => {
      if (this.flights.get(id) === flight) this.flights.delete(id);
    });
    this.flights.set(id, flight);
    return flight;
  }
  private async send(id: string) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    const d = this.snapshot.drafts[id];
    if (
      !this.active ||
      !this.canSave() ||
      !d ||
      this.sending.has(id) ||
      d.status === "saved" ||
      d.status === "conflict"
    )
      return;
    const input = this.pending.get(id) ?? {
      revision: d.saved.revision,
      answer: d.local.answer,
      markedForReview: d.local.markedForReview,
      activeTimeMs: d.local.activeTimeMs,
    };
    this.pending.set(id, input);
    const epoch = this.epoch;
    this.sending.add(id);
    this.snapshot.drafts[id] = { ...d, status: "saving", error: undefined };
    this.emit();
    try {
      const result = await this.transport.save(id, input);
      if (!this.active || epoch !== this.epoch || this.snapshot.submission === "complete") return;
      this.accept(id, result.state, input.activeTimeMs);
      this.sync(result.serverTime);
      this.failures.delete(id);
      this.automaticRetryBlocked.delete(id);
      this.pending.delete(id);
    } catch (error) {
      if (!this.active || epoch !== this.epoch || this.snapshot.submission === "complete") return;
      if (error instanceof ApiError && error.problem?.code === "ANSWER_REVISION_CONFLICT") {
        await this.reconcile(id, input, epoch);
      } else {
        const transient =
          !(error instanceof ApiError) || error.kind === "network" || error.status >= 500;
        this.snapshot.drafts[id] = {
          ...this.snapshot.drafts[id],
          status: "failed",
          error: transient
            ? "Chưa lưu được. Kiểm tra mạng hoặc thử lại."
            : "Máy chủ từ chối lưu. Kiểm tra câu trả lời và thời gian còn lại.",
        };
        if (transient) {
          const count = this.failures.get(id) ?? 0;
          if (count < 3 && this.snapshot.submission !== "saving") {
            this.failures.set(id, count + 1);
            this.schedule(id, 1000 * 2 ** count);
          }
        } else {
          this.automaticRetryBlocked.add(id);
          this.pending.delete(id);
          void this.refresh();
        }
      }
    } finally {
      if (epoch === this.epoch) {
        this.sending.delete(id);
        this.emit();
        if (this.canSave() && this.snapshot.drafts[id]?.status === "dirty") this.schedule(id, 0);
      }
    }
  }
  private accept(
    id: string,
    state: AnswerState,
    acknowledgedTime: number | null = state.activeTimeMs,
  ) {
    const d = this.snapshot.drafts[id];
    const equal =
      sameContent(d.local, state) && (d.local.activeTimeMs ?? 0) <= (acknowledgedTime ?? 0);
    this.snapshot.drafts[id] = {
      ...d,
      saved: state,
      local: equal ? state : { ...d.local, revision: state.revision },
      status: equal ? "saved" : "dirty",
      error: undefined,
      conflict: undefined,
    };
  }
  private async reconcile(id: string, sent: Save, epoch: number) {
    try {
      const a = await this.transport.read();
      if (!this.active || epoch !== this.epoch) return;
      this.acceptAttempt(a);
      if (this.snapshot.submission === "complete") return;
      const state = a.questions.find((q) => q.id === id)?.state;
      this.pending.delete(id);
      if (!state) {
        this.snapshot.drafts[id] = {
          ...this.snapshot.drafts[id],
          status: "failed",
          error: "Bài làm không còn cho phép sửa.",
        };
        return;
      }
      // Telemetry có thể bị server giới hạn; chỉ answer/review khác mới cần người làm đối chiếu.
      if (sameContent(state, sent)) this.accept(id, state, sent.activeTimeMs);
      else
        this.snapshot.drafts[id] = {
          ...this.snapshot.drafts[id],
          status: "conflict",
          conflict: state,
        };
    } catch {
      if (this.active && epoch === this.epoch)
        this.snapshot.drafts[id] = {
          ...this.snapshot.drafts[id],
          status: "failed",
          error: "Không tải được bản máy chủ để đối chiếu. Thử lại khi có mạng.",
        };
    }
  }
  resolve(id: string, useLocal: boolean) {
    const d = this.snapshot.drafts[id],
      state = d.conflict;
    if (!state || !this.editable()) return;
    this.pending.delete(id);
    this.failures.delete(id);
    this.snapshot.drafts[id] = {
      ...d,
      saved: state,
      local: useLocal
        ? {
            ...d.local,
            revision: state.revision,
            activeTimeMs: Math.max(d.local.activeTimeMs ?? 0, state.activeTimeMs ?? 0),
          }
        : state,
      status: useLocal ? "dirty" : "saved",
      conflict: undefined,
      error: undefined,
    };
    this.emit();
    if (useLocal) this.schedule(id, 0);
  }
}
