package com.learnova.notification.dto;

import java.time.Instant;
import java.util.UUID;

public final class NotificationDtos {
    private NotificationDtos() {}
    public record Item(UUID id, String type, String title, String message, String targetPath, Instant createdAt, Instant readAt) {}
    public record UnreadCount(long unreadCount) {}
}
