-- F13 sẽ bổ sung answers và thứ tự snapshot; F12 chỉ đọc metadata thật.
ALTER TABLE exam_sessions ADD CONSTRAINT uq_session_version UNIQUE (id, exam_version_id);
CREATE TABLE attempts (
    id uuid PRIMARY KEY,
    participant_id uuid NOT NULL REFERENCES users(id),
    session_id uuid NOT NULL,
    exam_version_id uuid NOT NULL,
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    status varchar(16) NOT NULL CHECK (status IN ('IN_PROGRESS','SUBMITTED','EXPIRED','GRADED')),
    started_at timestamptz NOT NULL,
    deadline timestamptz NOT NULL CHECK (deadline > started_at),
    submitted_at timestamptz CHECK (submitted_at >= started_at),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    FOREIGN KEY (session_id, exam_version_id) REFERENCES exam_sessions(id, exam_version_id),
    UNIQUE (participant_id, session_id, attempt_number)
);
CREATE UNIQUE INDEX uq_attempt_active ON attempts(participant_id, session_id) WHERE status='IN_PROGRESS';
CREATE INDEX ix_attempt_history ON attempts(participant_id, session_id, started_at DESC, id);
CREATE INDEX ix_attempt_session ON attempts(session_id);
