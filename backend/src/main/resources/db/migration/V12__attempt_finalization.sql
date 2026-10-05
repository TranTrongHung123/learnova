ALTER TABLE attempts ADD COLUMN completion_reason varchar(24)
    CHECK (completion_reason IN ('PARTICIPANT_SUBMIT','DEADLINE_REACHED'));
ALTER TABLE attempts ADD COLUMN graded_at timestamptz CHECK (graded_at >= submitted_at);
CREATE INDEX ix_attempt_due ON attempts(deadline, id) WHERE status = 'IN_PROGRESS';

CREATE TABLE attempt_results (
    attempt_id uuid PRIMARY KEY REFERENCES attempts(id),
    raw_score numeric NOT NULL CHECK (raw_score >= 0),
    total_score numeric NOT NULL CHECK (total_score > 0 AND raw_score <= total_score),
    passing_score numeric NOT NULL CHECK (passing_score >= 0 AND passing_score <= total_score),
    passed boolean NOT NULL,
    graded_at timestamptz NOT NULL,
    CHECK (passed = (raw_score >= passing_score))
);

CREATE TABLE attempt_result_questions (
    attempt_id uuid NOT NULL REFERENCES attempt_results(attempt_id),
    question_id uuid NOT NULL,
    correct boolean NOT NULL,
    points numeric NOT NULL CHECK (points > 0),
    awarded_score numeric NOT NULL,
    PRIMARY KEY (attempt_id, question_id),
    FOREIGN KEY (attempt_id, question_id) REFERENCES attempt_answers(attempt_id, question_id),
    CHECK (awarded_score = CASE WHEN correct THEN points ELSE 0 END)
);
