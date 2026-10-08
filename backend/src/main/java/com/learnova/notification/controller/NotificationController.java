package com.learnova.notification.controller;

import com.learnova.notification.dto.NotificationDtos.*;
import com.learnova.notification.service.NotificationService;
import com.learnova.shared.api.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<Item> list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "false") boolean unreadOnly,
        PageQuery page
    ) {
        return service.list(actor(jwt), unreadOnly, page);
    }

    @GetMapping("/unread-count")
    UnreadCount unread(@AuthenticationPrincipal Jwt jwt) {
        return service.unread(actor(jwt));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.read(actor(jwt), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void readAll(@AuthenticationPrincipal Jwt jwt) {
        service.readAll(actor(jwt));
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
