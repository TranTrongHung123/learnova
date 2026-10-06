export type Participant = {
  participantId: string; displayName: string; attemptId?: string; attemptNumber: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "GRADED";
  answeredCount: number; totalQuestions: number; lastSeen?: string;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "NOT_APPLICABLE";
};
export type Summary = { total: number; notStarted?: number | null; inProgress: number; submitted: number; disconnected: number };
export type Snapshot = {
  sessionId: string; title: string; sessionStatus: string; accessType: string; serverTime: string;
  summary: Summary; participants: Participant[];
};
export type Frame = Omit<Snapshot, "participants"> & {
  type: "SYNC" | "DELTA"; streamId: string; sequence: number;
  changes: { type: "STARTED" | "SUBMITTED" | "CONNECTED" | "DISCONNECTED" | "PROGRESS"; participant: Participant }[];
  removedParticipantIds: string[];
};
export type StreamState = { snapshot: Snapshot; streamId: string; sequence: number };

export function applyFrame(state: StreamState | undefined, frame: Frame): StreamState {
  if (!frame || !["SYNC", "DELTA"].includes(frame.type) || !Number.isSafeInteger(frame.sequence) ||
      !Array.isArray(frame.changes) || !Array.isArray(frame.removedParticipantIds)) throw new Error("Invalid monitoring frame");
  if (state && frame.streamId === state.streamId && frame.sequence <= state.sequence) return state;
  if (frame.type === "SYNC") {
    if (state || frame.sequence !== 1) throw new Error("Unexpected monitoring stream");
  } else if (!state || frame.streamId !== state.streamId || frame.sequence !== state.sequence + 1 || frame.sessionId !== state.snapshot.sessionId) {
    throw new Error("Monitoring stream gap");
  }
  const rows = new Map((frame.type === "SYNC" ? [] : state!.snapshot.participants).map(p => [p.participantId, p]));
  frame.removedParticipantIds.forEach(id => rows.delete(id));
  frame.changes.forEach(change => rows.set(change.participant.participantId, change.participant));
  return { streamId: frame.streamId, sequence: frame.sequence, snapshot: {
    sessionId: frame.sessionId, title: frame.title, sessionStatus: frame.sessionStatus, accessType: frame.accessType,
    serverTime: frame.serverTime, summary: frame.summary,
    participants: [...rows.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "vi") || a.participantId.localeCompare(b.participantId)),
  } };
}
