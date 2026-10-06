package com.learnova.monitoring.service;

import com.learnova.monitoring.dto.MonitoringDtos.*;
import com.learnova.monitoring.repository.MonitoringQueries;
import com.learnova.session.service.SessionService;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class MonitoringService {
    private final SessionService sessions;
    private final MonitoringQueries queries;
    private final Clock clock;
    public MonitoringService(SessionService sessions, MonitoringQueries queries, Clock clock) {
        this.sessions=sessions; this.queries=queries; this.clock=clock;
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Snapshot snapshot(UUID actor, UUID session) {
        var s=sessions.detail(actor,session);
        var now=clock.instant();
        var rows=queries.participants(session,s.questionCount(),now);
        int waiting=0,progress=0,submitted=0,disconnected=0;
        for (var row:rows) {
            if (row.status().equals("NOT_STARTED")) waiting++;
            else if (row.status().equals("IN_PROGRESS")) progress++;
            else submitted++;
            if (row.connectionStatus().equals("DISCONNECTED")) disconnected++;
        }
        return new Snapshot(session,s.title(),s.status().name(),s.accessType().name(),now,
            new Summary(rows.size(),s.accessType().name().equals("PUBLIC")?null:waiting,progress,submitted,disconnected),rows);
    }
}
