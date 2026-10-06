package com.learnova.monitoring.service;

import com.learnova.monitoring.dto.MonitoringDtos.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class MonitoringStream {
    private final UUID id=UUID.randomUUID();
    private long sequence;
    private Map<UUID,Participant> previous=Map.of();

    public Frame next(Snapshot snapshot) {
        boolean initial=sequence==0;
        var current=snapshot.participants().stream().collect(Collectors.toMap(Participant::participantId,Function.identity()));
        var changes=snapshot.participants().stream().filter(p->!p.equals(previous.get(p.participantId())))
            .map(p->new Change(event(previous.get(p.participantId()),p),p)).toList();
        var removed=previous.keySet().stream().filter(p->!current.containsKey(p)).toList();
        previous=current;
        return new Frame(initial?"SYNC":"DELTA",id,++sequence,snapshot.sessionId(),snapshot.title(),snapshot.sessionStatus(),
            snapshot.accessType(),snapshot.serverTime(),snapshot.summary(),changes,removed);
    }
    private String event(Participant before,Participant after) {
        if (after.attemptId()!=null && (before==null || !after.attemptId().equals(before.attemptId())))
            return after.status().equals("IN_PROGRESS")?"STARTED":"SUBMITTED";
        if (before!=null && !before.status().equals(after.status()) && !after.status().equals("IN_PROGRESS")) return "SUBMITTED";
        if (before==null || !before.connectionStatus().equals(after.connectionStatus())) {
            if (after.connectionStatus().equals("CONNECTED")) return "CONNECTED";
            if (after.connectionStatus().equals("DISCONNECTED")) return "DISCONNECTED";
        }
        return "PROGRESS";
    }
}
