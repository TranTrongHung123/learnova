ALTER TABLE attempts ADD CONSTRAINT uq_attempt_version UNIQUE (id, exam_version_id);
ALTER TABLE exam_version_questions ADD CONSTRAINT uq_version_question_id UNIQUE (version_id, id);

CREATE TABLE attempt_answers (
    attempt_id uuid NOT NULL,
    exam_version_id uuid NOT NULL,
    question_id uuid NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    option_order jsonb NOT NULL CHECK (jsonb_typeof(option_order) = 'array'),
    answer jsonb NOT NULL DEFAULT '{"optionIds":[],"booleanValue":null,"numericValue":null}' CHECK (jsonb_typeof(answer) = 'object'),
    marked_for_review boolean NOT NULL DEFAULT false,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    active_time_ms bigint CHECK (active_time_ms >= 0),
    saved_at timestamptz,
    PRIMARY KEY (attempt_id, question_id),
    UNIQUE (attempt_id, position),
    FOREIGN KEY (attempt_id, exam_version_id) REFERENCES attempts(id, exam_version_id),
    FOREIGN KEY (exam_version_id, question_id) REFERENCES exam_version_questions(version_id, id)
);

-- Metadata F12 chưa từng lưu shuffle/answer; dùng thứ tự snapshot gốc khi nâng cấp.
INSERT INTO attempt_answers(attempt_id, exam_version_id, question_id, position, option_order)
SELECT a.id, a.exam_version_id, q.id, q.position,
    coalesce((SELECT jsonb_agg(o.value->'id' ORDER BY o.ordinality)
              FROM jsonb_array_elements(q.snapshot->'options') WITH ORDINALITY o), '[]'::jsonb)
FROM attempts a JOIN exam_version_questions q ON q.version_id=a.exam_version_id;
