package com.learnova.attempt.service;

import com.learnova.attempt.dto.ResultDtos.*;
import com.learnova.attempt.repository.ResultQueries;
import com.learnova.identity.service.IdentityService;
import com.learnova.session.service.SessionService;
import com.learnova.session.exception.SessionFailure;
import com.learnova.shared.api.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class ResultService {
    private final ResultQueries queries;
    private final IdentityService identity;
    private final SessionService sessions;
    private final Clock clock;
    public ResultService(ResultQueries queries,IdentityService identity,SessionService sessions,Clock clock) {
        this.queries=queries; this.identity=identity; this.sessions=sessions; this.clock=clock;
    }
    public PageResponse<History> history(UUID actor,PageQuery page) {
        authorize(actor,"PARTICIPANT"); return queries.history(actor,false,clock.instant(),page);
    }
    public Detail detail(UUID actor,UUID id,boolean creator) {
        authorize(actor,creator?"CREATOR":"PARTICIPANT");
        var a=queries.attempt(id).orElseThrow(()->new SessionFailure(404,"RESULT_NOT_FOUND"));
        if (!(creator?a.ownerId():a.participantId()).equals(actor)) throw new SessionFailure(404,"RESULT_NOT_FOUND");
        String availability=creator?(a.score()!=null?"AVAILABLE":"PENDING_GRADING"):
            ResultVisibility.availability(a.mode(),a.policy(),a.end(),a.released(),clock.instant(),a.score()!=null);
        boolean visible=availability.equals("AVAILABLE"), summary=visible&&(creator||!a.mode().equals("SCORE_ONLY"));
        return new Detail(a.id(),a.sessionId(),a.title(),a.number(),a.status(),a.submitted(),creator?"DETAILED":a.mode(),availability,
            visible?a.score():null,summary?queries.summary(a):null,visible&&(creator||a.mode().equals("DETAILED"))?queries.questions(id):null);
    }
    public SessionResults session(UUID actor,UUID id,PageQuery page) {
        var s=sessions.detail(actor,id); var released=queries.releasedAt(id);
        return new SessionResults(s.title(),s.resultDisplayMode().name(),s.resultReleasePolicy().name(),released,
            s.resultReleasePolicy().name().equals("MANUAL")&&released==null&&!s.status().name().equals("DRAFT")&&!s.status().name().equals("CANCELLED"),
            queries.history(id,true,clock.instant(),page));
    }
    public PageResponse<Detail> attempts(UUID actor,UUID session,UUID participant,PageQuery page,boolean creator) {
        if (creator) sessions.detail(actor,session); else { authorize(actor,"PARTICIPANT"); participant=actor; }
        var ids=queries.attemptIds(session,participant,page);
        return new PageResponse<>(ids.content().stream().map(id->detail(actor,id,creator)).toList(),ids.page(),ids.size(),ids.totalElements(),ids.totalPages());
    }
    private void authorize(UUID actor,String role) {
        if (!identity.activeUser(actor).roles().contains(role)) throw new SessionFailure(403,"FORBIDDEN");
    }
}
