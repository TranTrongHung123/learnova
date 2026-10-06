ALTER TABLE exam_sessions ADD COLUMN results_released_at timestamptz;
CREATE INDEX ix_attempt_participant_session ON attempts(participant_id, session_id, submitted_at DESC);
