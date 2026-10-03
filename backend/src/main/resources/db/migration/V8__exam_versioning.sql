CREATE TABLE exams (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id),
    name varchar(200) NOT NULL CHECK (btrim(name) <> ''),
    description varchar(5000),
    status varchar(16) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    revision bigint NOT NULL CHECK (revision >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX ix_exams_owner_updated ON exams(owner_id, status, updated_at DESC, id DESC);
CREATE TABLE exam_versions (
    id uuid PRIMARY KEY,
    exam_id uuid NOT NULL REFERENCES exams(id),
    version_number integer NOT NULL CHECK (version_number > 0),
    status varchar(16) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
    revision bigint NOT NULL CHECK (revision >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    published_at timestamptz,
    UNIQUE (exam_id, version_number),
    CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL))
);
CREATE TABLE exam_version_questions (
    id uuid PRIMARY KEY,
    version_id uuid NOT NULL REFERENCES exam_versions(id),
    source_question_id uuid NOT NULL,
    source_revision bigint NOT NULL CHECK (source_revision >= 0),
    position integer NOT NULL CHECK (position >= 0),
    points numeric(30,10) NOT NULL CHECK (points > 0),
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    UNIQUE (version_id, source_question_id),
    CONSTRAINT uq_exam_question_position UNIQUE (version_id, position) DEFERRABLE INITIALLY DEFERRED
);
