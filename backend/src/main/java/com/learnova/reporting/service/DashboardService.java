package com.learnova.reporting.service;

import com.learnova.reporting.dto.DashboardDtos.*;
import com.learnova.reporting.repository.DashboardQueries;
import com.learnova.identity.service.IdentityService;
import com.learnova.notification.service.NotificationService;
import com.learnova.session.service.DiscoveryService;
import com.learnova.session.dto.DiscoveryDtos.Tab;
import com.learnova.shared.api.PageQuery;
import java.time.Clock;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class DashboardService {
    private static final PageQuery PREVIEW=new PageQuery(0,5);
    private final DashboardQueries queries;
    private final IdentityService identity;
    private final DiscoveryService discovery;
    private final NotificationService notifications;
    private final Clock clock;
    public DashboardService(DashboardQueries queries,IdentityService identity,DiscoveryService discovery,NotificationService notifications,Clock clock) {
        this.queries=queries; this.identity=identity; this.discovery=discovery; this.notifications=notifications; this.clock=clock;
    }
    public Participant participant(UUID actor) {
        authorize(actor,"PARTICIPANT"); var now=clock.instant();
        return new Participant(now,discovery.list(actor,Tab.AVAILABLE,PREVIEW),discovery.list(actor,Tab.UPCOMING,PREVIEW),
            discovery.list(actor,Tab.COMPLETED,PREVIEW),queries.inProgress(actor,now),queries.scores(actor,now),
            queries.participantResults(actor,now),notifications.unread(actor).unreadCount(),notifications.list(actor,false,PREVIEW).content());
    }
    public Creator creator(UUID actor) {
        authorize(actor,"CREATOR"); var now=clock.instant();
        return new Creator(now,queries.counts(actor,now),queries.questionCounts(actor),queries.sessions(actor,now,false),
            queries.sessions(actor,now,true),queries.exams(actor),queries.creatorResults(actor));
    }
    public Admin admin(UUID actor) { authorize(actor,"ADMIN"); return queries.admin(clock.instant()); }
    private void authorize(UUID actor,String role) {
        if (!identity.activeUser(actor).roles().contains(role)) throw new AccessDeniedException("FORBIDDEN");
    }
}
