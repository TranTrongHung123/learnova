CREATE TABLE exam_sessions (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id),
    exam_id uuid NOT NULL REFERENCES exams(id),
    exam_version_id uuid NOT NULL REFERENCES exam_versions(id),
    title varchar(200) NOT NULL CHECK (btrim(title) <> ''),
    status varchar(16) NOT NULL CHECK (status IN ('DRAFT','SCHEDULED','OPEN','CLOSED','CANCELLED')),
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL CHECK (end_time > start_time),
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
    max_attempts integer NOT NULL CHECK (max_attempts > 0),
    passing_score numeric(30,10) NOT NULL CHECK (passing_score >= 0),
    access_type varchar(16) NOT NULL CHECK (access_type IN ('PUBLIC','CLASS','INDIVIDUAL')),
    shuffle_questions boolean NOT NULL,
    shuffle_answers boolean NOT NULL,
    result_display_mode varchar(16) NOT NULL CHECK (result_display_mode IN ('HIDDEN','SCORE_ONLY','SUMMARY','DETAILED')),
    result_release_policy varchar(24) NOT NULL CHECK (result_release_policy IN ('IMMEDIATE','AFTER_SESSION_END','MANUAL')),
    first_attempt_at timestamptz,
    revision bigint NOT NULL CHECK (revision >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX ix_sessions_owner_updated ON exam_sessions(owner_id, updated_at DESC, id DESC);
CREATE INDEX ix_sessions_lifecycle ON exam_sessions(status, start_time, end_time);
CREATE INDEX ix_sessions_exam ON exam_sessions(exam_id);
CREATE TABLE session_class_assignments (
    session_id uuid NOT NULL REFERENCES exam_sessions(id),
    classroom_id uuid NOT NULL REFERENCES classrooms(id),
    PRIMARY KEY(session_id, classroom_id)
);
CREATE INDEX ix_session_classes_class ON session_class_assignments(classroom_id, session_id);
CREATE TABLE session_individual_assignments (
    session_id uuid NOT NULL REFERENCES exam_sessions(id),
    user_id uuid NOT NULL REFERENCES users(id),
    PRIMARY KEY(session_id, user_id)
);
CREATE INDEX ix_session_individuals_user ON session_individual_assignments(user_id, session_id);
