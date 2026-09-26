CREATE TABLE audit_records (
    id uuid PRIMARY KEY,
    actor_user_id varchar(128),
    action varchar(64) NOT NULL CHECK (btrim(action) <> ''),
    target_type varchar(64) NOT NULL CHECK (btrim(target_type) <> ''),
    target_id varchar(128) NOT NULL CHECK (btrim(target_id) <> ''),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    occurred_at timestamptz NOT NULL,
    CHECK (actor_user_id IS NULL OR btrim(actor_user_id) <> '')
);

CREATE INDEX ix_audit_records_time ON audit_records (occurred_at DESC, id);
CREATE INDEX ix_audit_records_actor_time ON audit_records (actor_user_id, occurred_at DESC);
CREATE INDEX ix_audit_records_action_time ON audit_records (action, occurred_at DESC);
CREATE INDEX ix_audit_records_target_time ON audit_records (target_type, target_id, occurred_at DESC);
