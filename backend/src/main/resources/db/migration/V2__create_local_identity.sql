CREATE TABLE users (
    id uuid PRIMARY KEY,
    email varchar(254) NOT NULL UNIQUE,
    display_name varchar(100) NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
    created_at timestamptz NOT NULL,
    CHECK (email = lower(btrim(email)))
);
CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id),
    role varchar(16) NOT NULL CHECK (role IN ('PARTICIPANT', 'CREATOR', 'ADMIN')),
    PRIMARY KEY (user_id, role)
);
CREATE TABLE auth_identities (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    provider varchar(16) NOT NULL CHECK (provider IN ('LOCAL', 'GOOGLE')),
    provider_subject varchar(254) NOT NULL,
    password_hash varchar(512),
    UNIQUE (provider, provider_subject),
    UNIQUE (user_id, provider),
    CHECK ((provider = 'LOCAL' AND password_hash IS NOT NULL)
        OR (provider = 'GOOGLE' AND password_hash IS NULL))
);
