package com.learnova.exam.controller;

import com.learnova.exam.dto.ExamDtos.*;
import com.learnova.exam.enums.ExamStatus;
import com.learnova.exam.service.ExamService;
import com.learnova.shared.api.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class ExamController {
    private final ExamService service;
    public ExamController(ExamService service) { this.service = service; }
    @GetMapping("/exams")
    PageResponse<ExamSummary> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "") @Size(max = 200) String keyword,
            @RequestParam(required = false) ExamStatus status, PageQuery page) { return service.list(actor(jwt), keyword, status, page); }
    @PostMapping("/exams") @ResponseStatus(HttpStatus.CREATED)
    ExamDetail create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateExam input) { return service.create(actor(jwt), input); }
    @GetMapping("/exams/{id}")
    ExamDetail detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) { return service.detail(actor(jwt), id); }
    @PostMapping("/exams/{id}/archive")
    ExamDetail archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Revision input) { return service.archive(actor(jwt), id, input.revision()); }
    @PostMapping("/exams/{id}/versions") @ResponseStatus(HttpStatus.CREATED)
    VersionDetail createVersion(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody NewVersion input) { return service.createVersion(actor(jwt), id, input); }
    @GetMapping("/exam-versions/{id}")
    VersionDetail version(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) { return service.version(actor(jwt), id); }
    @PostMapping("/exam-versions/{id}/questions")
    VersionDetail add(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody AddQuestions input) { return service.add(actor(jwt), id, input); }
    @PutMapping("/exam-versions/{id}/questions")
    VersionDetail save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SaveQuestions input) { return service.save(actor(jwt), id, input); }
    @PostMapping("/exam-versions/{id}/publish")
    VersionDetail publish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Revision input) { return service.publish(actor(jwt), id, input.revision()); }
    @PostMapping("/exam-versions/{id}/generation/preview")
    MatrixPreview preview(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody MatrixRequest input) { return service.previewMatrix(actor(jwt), id, input); }
    @PostMapping("/exam-versions/{id}/generation")
    VersionDetail generate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody MatrixRequest input) { return service.generate(actor(jwt), id, input); }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
