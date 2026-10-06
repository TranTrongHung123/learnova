package com.learnova.attempt.controller;

import com.learnova.attempt.dto.AttemptDtos.*;
import com.learnova.attempt.service.AttemptService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AttemptController {
    private final AttemptService service;
    public AttemptController(AttemptService service) { this.service=service; }
    @PostMapping("/exam-sessions/{id}/attempts")
    ResponseEntity<View> start(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var result=service.start(UUID.fromString(jwt.getSubject()),id);
        return ResponseEntity.status(result.created()?201:200).header("Cache-Control","no-store").body(result.attempt());
    }
    @GetMapping("/attempts/{id}")
    ResponseEntity<View> read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.ok().header("Cache-Control","no-store").body(service.read(UUID.fromString(jwt.getSubject()),id));
    }
    @PutMapping("/attempts/{id}/answers/{questionId}")
    ResponseEntity<Saved> save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID questionId, @Valid @RequestBody Save input) {
        return ResponseEntity.ok().header("Cache-Control","no-store").body(service.save(UUID.fromString(jwt.getSubject()),id,questionId,input));
    }
    @PostMapping("/attempts/{id}/submit")
    ResponseEntity<View> submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.ok().header("Cache-Control","no-store").body(service.submit(UUID.fromString(jwt.getSubject()),id));
    }
}
