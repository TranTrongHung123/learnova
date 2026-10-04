package com.learnova.session.service;

import com.learnova.identity.service.IdentityService;
import com.learnova.session.dto.DiscoveryDtos.*;
import com.learnova.session.exception.SessionFailure;
import com.learnova.session.repository.DiscoveryQueries;
import com.learnova.shared.api.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class DiscoveryService {
    private final DiscoveryQueries queries;
    private final IdentityService identity;
    private final Clock clock;
    public DiscoveryService(DiscoveryQueries queries, IdentityService identity, Clock clock) {
        this.queries=queries; this.identity=identity; this.clock=clock;
    }
    public PageResponse<Session> list(UUID actor, Tab tab, PageQuery page) {
        authorize(actor); return queries.list(actor,clock.instant(),tab,page);
    }
    public Session detail(UUID actor, UUID id) {
        authorize(actor);
        return queries.detail(actor,id,clock.instant()).orElseThrow(()->new SessionFailure(404,"SESSION_NOT_FOUND"));
    }
    public PageResponse<Attempt> history(UUID actor, UUID id, PageQuery page) {
        detail(actor,id); return queries.history(actor,id,page);
    }
    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("PARTICIPANT")) throw new SessionFailure(403,"FORBIDDEN");
    }
}
