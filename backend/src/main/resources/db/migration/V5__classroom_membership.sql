CREATE TABLE classrooms (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id),
    name varchar(200) NOT NULL CHECK (btrim(name) <> ''),
    description varchar(2000),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX ix_classrooms_owner ON classrooms(owner_id, updated_at DESC, id);

CREATE TABLE classroom_memberships (
    id uuid PRIMARY KEY,
    classroom_id uuid NOT NULL REFERENCES classrooms(id),
    user_id uuid NOT NULL REFERENCES users(id),
    status varchar(16) NOT NULL CHECK (status IN ('ACTIVE', 'REMOVED')),
    joined_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    UNIQUE (classroom_id, user_id)
);
CREATE INDEX ix_memberships_user ON classroom_memberships(user_id, status, joined_at DESC, id);
CREATE INDEX ix_memberships_class_status ON classroom_memberships(classroom_id, status);

CREATE TABLE classroom_join_codes (
    classroom_id uuid PRIMARY KEY REFERENCES classrooms(id),
    code varchar(16) NOT NULL UNIQUE CHECK (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$'),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
    revoked_at timestamptz
);
