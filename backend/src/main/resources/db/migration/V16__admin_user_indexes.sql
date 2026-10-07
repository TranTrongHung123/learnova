CREATE INDEX ix_users_created ON users (created_at DESC, id DESC);
CREATE INDEX ix_users_status_created ON users (status, created_at DESC, id DESC);
CREATE INDEX ix_user_roles_role_user ON user_roles (role, user_id);
