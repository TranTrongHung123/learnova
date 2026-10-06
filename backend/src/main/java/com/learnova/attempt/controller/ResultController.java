package com.learnova.attempt.controller;

import com.learnova.attempt.dto.ResultDtos.*;
import com.learnova.attempt.service.ResultService;
import com.learnova.shared.api.*;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class ResultController {
    private final ResultService service;
    public ResultController(ResultService service) { this.service=service; }
    @GetMapping("/participant/results")
    PageResponse<History> history(@AuthenticationPrincipal Jwt jwt,PageQuery page) { return service.history(actor(jwt),page); }
    @GetMapping("/participant/results/{id}")
    Detail detail(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) { return service.detail(actor(jwt),id,false); }
    @GetMapping("/participant/exam-sessions/{id}/results")
    PageResponse<Detail> attempts(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,PageQuery page) { return service.attempts(actor(jwt),id,actor(jwt),page,false); }
    @GetMapping("/exam-sessions/{id}/results")
    SessionResults session(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,PageQuery page) { return service.session(actor(jwt),id,page); }
    @GetMapping("/exam-sessions/{id}/results/{participantId}/attempts")
    PageResponse<Detail> participant(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID participantId,PageQuery page) {
        return service.attempts(actor(jwt),id,participantId,page,true);
    }
    @GetMapping("/exam-sessions/{id}/attempts/{attemptId}/result")
    Detail creatorDetail(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID attemptId) {
        var detail=service.detail(actor(jwt),attemptId,true);
        if (!detail.sessionId().equals(id)) throw new com.learnova.session.exception.SessionFailure(404,"RESULT_NOT_FOUND");
        return detail;
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
