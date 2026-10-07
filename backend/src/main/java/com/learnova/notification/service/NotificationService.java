package com.learnova.notification.service;

import com.learnova.identity.service.IdentityService;
import com.learnova.notification.dto.NotificationDtos.*;
import com.learnova.notification.repository.NotificationRepository;
import com.learnova.shared.api.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class NotificationService {
    private final NotificationRepository repository;
    private final IdentityService identity;
    private final Clock clock;
    public NotificationService(NotificationRepository repository, IdentityService identity, Clock clock) {
        this.repository=repository; this.identity=identity; this.clock=clock;
    }
    public PageResponse<Item> list(UUID actor, boolean unread, PageQuery page) {
        authorize(actor); return repository.list(actor,unread,page);
    }
    public UnreadCount unread(UUID actor) { authorize(actor); return new UnreadCount(repository.unread(actor)); }
    @Transactional
    public void read(UUID actor, UUID id) {
        authorize(actor);
        if (!repository.read(actor,id,clock.instant())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    @Transactional
    public void readAll(UUID actor) { authorize(actor); repository.readAll(actor,clock.instant()); }
    private void authorize(UUID actor) {
        var roles=identity.activeUser(actor).roles();
        if (!roles.contains("PARTICIPANT") && !roles.contains("CREATOR")) throw new AccessDeniedException("FORBIDDEN");
    }
}
