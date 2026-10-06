package com.learnova.session.controller;

import com.learnova.session.dto.SessionDtos.*;
import com.learnova.session.enums.SessionStatus;
import com.learnova.session.service.SessionService;
import com.learnova.identity.service.ParticipantDirectory.Participant;
import com.learnova.shared.api.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/exam-sessions")
public class SessionController {
    private final SessionService service;
    public SessionController(SessionService service) { this.service=service; }
    @GetMapping
    PageResponse<Detail> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required=false) SessionStatus status,
            @RequestParam(required=false) UUID examId, @RequestParam(required=false) UUID classroomId, PageQuery page) {
        return service.list(actor(jwt),status,examId,classroomId,page);
    }
    @GetMapping("/participants/lookup")
    Participant lookup(@AuthenticationPrincipal Jwt jwt,@RequestParam @Email @NotBlank @Size(max=254) String email) { return service.lookup(actor(jwt),email); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    Detail create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody WriteSession input) { return service.create(actor(jwt),input); }
    @GetMapping("/{id}")
    Detail detail(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) { return service.detail(actor(jwt),id); }
    @PutMapping("/{id}")
    Detail update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody WriteSession input) { return service.update(actor(jwt),id,input); }
    @PostMapping("/{id}/schedule")
    Detail schedule(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Revision input) { return service.schedule(actor(jwt),id,input.revision()); }
    @PostMapping("/{id}/cancel")
    Detail cancel(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Revision input) { return service.cancel(actor(jwt),id,input.revision()); }
    @PostMapping("/{id}/extend-end-time")
    Detail extend(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Extend input) { return service.extend(actor(jwt),id,input); }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    @PostMapping("/{id}/release-results")
    SessionService.ResultRelease release(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        return service.releaseResults(actor(jwt),id);
    }
}
