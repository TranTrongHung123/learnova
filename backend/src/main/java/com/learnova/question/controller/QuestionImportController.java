package com.learnova.question.controller;

import com.learnova.question.dto.QuestionImportDtos.*;
import com.learnova.question.service.QuestionImportService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/question-imports")
public class QuestionImportController {

    private final QuestionImportService service;

    public QuestionImportController(QuestionImportService service) {
        this.service = service;
    }

    @GetMapping("/template")
    ResponseEntity<byte[]> template(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok()
            .contentType(
                MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            )
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=learnova-questions.xlsx")
            .cacheControl(CacheControl.noStore())
            .body(service.template(actor(jwt)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    Preview upload(@AuthenticationPrincipal Jwt jwt, @RequestParam MultipartFile file) {
        return service.upload(actor(jwt), file);
    }

    @GetMapping("/{id}")
    Preview preview(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "ALL") RowFilter filter,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return service.preview(actor(jwt), id, filter, page, size);
    }

    @PostMapping("/{id}/confirm")
    Preview confirm(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestBody Confirm input
    ) {
        return service.confirm(actor(jwt), id, Boolean.TRUE.equals(input.validRowsOnly()));
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
