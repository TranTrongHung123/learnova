package com.learnova.classroom.controller;

import com.learnova.classroom.dto.ClassroomDtos.*;
import com.learnova.classroom.enums.MembershipStatus;
import com.learnova.classroom.service.ClassroomService;
import com.learnova.identity.service.ParticipantDirectory;
import com.learnova.shared.api.PageQuery;
import com.learnova.shared.api.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/classrooms")
public class ClassroomController {

    private final ClassroomService service;

    public ClassroomController(ClassroomService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<OwnerSummary> owned(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "") @Size(max = 200) String search,
        PageQuery page
    ) {
        return service.owned(actor(jwt), search, page);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OwnerDetail create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WriteClassroom input) {
        return service.create(actor(jwt), input);
    }

    @GetMapping("/{id}")
    OwnerDetail detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.detail(actor(jwt), id);
    }

    @PutMapping("/{id}")
    OwnerDetail update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @Valid @RequestBody WriteClassroom input
    ) {
        return service.update(actor(jwt), id, input);
    }

    @GetMapping("/{id}/participants/lookup")
    ParticipantDirectory.Participant lookup(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestParam @NotBlank @Size(max = 254) String email
    ) {
        return service.lookup(actor(jwt), id, email);
    }

    @GetMapping("/{id}/members")
    PageResponse<Member> members(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "") @Size(max = 254) String search,
        @RequestParam(required = false) MembershipStatus status,
        PageQuery page
    ) {
        return service.members(actor(jwt), id, search, status, page);
    }

    @PostMapping("/{id}/members")
    Membership add(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @Valid @RequestBody AddMember input
    ) {
        return service.add(actor(jwt), id, input.userId());
    }

    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @PathVariable UUID userId
    ) {
        service.remove(actor(jwt), id, userId);
    }

    @PostMapping("/{id}/join-code")
    JoinCodeView regenerate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.regenerate(actor(jwt), id);
    }

    @DeleteMapping("/{id}/join-code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.revoke(actor(jwt), id);
    }

    @PostMapping("/join-preview")
    Preview preview(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CodeRequest input) {
        return service.preview(actor(jwt), input.code());
    }

    @PostMapping("/join")
    Membership join(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CodeRequest input) {
        return service.join(actor(jwt), input.code());
    }

    @GetMapping("/joined")
    PageResponse<ParticipantClassroom> joined(@AuthenticationPrincipal Jwt jwt, PageQuery page) {
        return service.joined(actor(jwt), page);
    }

    @PostMapping("/{id}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void leave(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.leave(actor(jwt), id);
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
