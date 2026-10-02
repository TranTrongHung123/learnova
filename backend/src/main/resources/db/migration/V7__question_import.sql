CREATE TABLE question_imports (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id),
    status varchar(16) NOT NULL CHECK (status IN ('READY', 'CONFIRMED', 'EXPIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    confirmed_at timestamptz,
    total_rows integer NOT NULL CHECK (total_rows BETWEEN 1 AND 1000),
    valid_rows integer NOT NULL CHECK (valid_rows BETWEEN 0 AND total_rows),
    payload jsonb,
    CHECK (expires_at > created_at),
    CHECK ((status = 'CONFIRMED') = (confirmed_at IS NOT NULL)),
    CHECK (status <> 'READY' OR payload IS NOT NULL)
);
CREATE INDEX ix_question_imports_expiry ON question_imports(expires_at) WHERE payload IS NOT NULL;
CREATE INDEX ix_question_imports_owner ON question_imports(owner_id);
