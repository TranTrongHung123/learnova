CREATE TABLE questions (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id),
    type varchar(24) NOT NULL CHECK (type IN ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','NUMERIC_ANSWER')),
    status varchar(16) NOT NULL CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    content varchar(10000) NOT NULL,
    explanation varchar(10000),
    difficulty varchar(16) CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
    category varchar(100),
    correct_boolean boolean,
    correct_value numeric(30,10),
    tolerance numeric(30,10) NOT NULL DEFAULT 0 CHECK (tolerance >= 0),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX ix_questions_owner_updated ON questions(owner_id, updated_at DESC, id DESC);
CREATE INDEX ix_questions_owner_filter ON questions(owner_id, status, type, difficulty);
CREATE TABLE question_options (
    question_id uuid NOT NULL REFERENCES questions(id),
    position integer NOT NULL CHECK (position BETWEEN 0 AND 19),
    content varchar(2000) NOT NULL,
    correct boolean NOT NULL,
    PRIMARY KEY (question_id, position)
);
CREATE TABLE question_tags (
    question_id uuid NOT NULL REFERENCES questions(id),
    tag varchar(50) NOT NULL CHECK (btrim(tag) <> ''),
    PRIMARY KEY (question_id, tag)
);
CREATE INDEX ix_question_tags_tag ON question_tags(tag, question_id);
