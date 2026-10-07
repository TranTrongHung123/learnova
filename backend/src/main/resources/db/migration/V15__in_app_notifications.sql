ALTER TABLE exam_sessions ADD COLUMN scheduled_at timestamptz;
-- Không suy đoán thời điểm schedule cũ để gửi nhắc bù sau nâng cấp.
UPDATE exam_sessions SET scheduled_at = CURRENT_TIMESTAMP WHERE status <> 'DRAFT';
CREATE TABLE notifications (
    id uuid PRIMARY KEY,
    recipient_id uuid NOT NULL REFERENCES users(id),
    type varchar(24) NOT NULL CHECK (type IN ('EXAM_ASSIGNED','EXAM_REMINDER','RESULT_RELEASED','CLASS_JOINED')),
    event_key varchar(160) NOT NULL,
    title varchar(250) NOT NULL,
    message varchar(1000) NOT NULL,
    target_path varchar(200) NOT NULL CHECK (target_path ~ '^/(participant|creator)/[a-z]+(/[0-9a-f-]+)?$'),
    created_at timestamptz NOT NULL,
    read_at timestamptz,
    UNIQUE(type, event_key, recipient_id)
);
CREATE INDEX ix_notifications_recipient ON notifications(recipient_id, created_at DESC, id DESC);
CREATE INDEX ix_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
