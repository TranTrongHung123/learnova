package com.learnova.question.controller;

import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.enums.*;
import com.learnova.question.service.QuestionService;
import com.learnova.shared.api.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/questions")
public class QuestionController {

    private final QuestionService service;

    public QuestionController(QuestionService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<Summary> list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "") @Size(max = 200) String keyword,
        @RequestParam(required = false) QuestionType type,
        @RequestParam(required = false) Difficulty difficulty,
        @RequestParam(required = false) @Size(max = 50) String tag,
        @RequestParam(required = false) @Size(max = 100) String category,
        @RequestParam(required = false) QuestionStatus status,
        PageQuery page
    ) {
        return service.list(actor(jwt), keyword, type, difficulty, tag, category, status, page);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Detail create(@AuthenticationPrincipal Jwt jwt, @RequestBody WriteQuestion input) {
        return service.create(actor(jwt), input);
    }

    @GetMapping("/{id}")
    Detail detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.detail(actor(jwt), id);
    }

    @PutMapping("/{id}")
    Detail update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestBody WriteQuestion input
    ) {
        return service.update(actor(jwt), id, input);
    }

    @PostMapping("/{id}/archive")
    Detail archive(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @Valid @RequestBody Revision input
    ) {
        return service.archive(actor(jwt), id, input.revision());
    }

    @PostMapping("/{id}/restore")
    Detail restore(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @Valid @RequestBody Revision input
    ) {
        return service.restore(actor(jwt), id, input.revision());
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
