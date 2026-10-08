package com.learnova.session.service;

import com.learnova.session.repository.SessionRepository;
import java.time.Clock;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionLifecycle {

    private final SessionRepository sessions;
    private final Clock clock;

    public SessionLifecycle(SessionRepository sessions, Clock clock) {
        this.sessions = sessions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<UUID> due() {
        return sessions.due(clock.instant(), PageRequest.of(0, 100));
    }

    @Transactional
    public void advance(UUID id) {
        sessions.lockById(id).ifPresent(s -> s.advance(clock.instant()));
    }
}
