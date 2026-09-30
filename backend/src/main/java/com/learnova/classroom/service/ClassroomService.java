package com.learnova.classroom.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.classroom.dto.ClassroomDtos.*;
import com.learnova.classroom.entity.*;
import com.learnova.classroom.enums.MembershipStatus;
import com.learnova.classroom.exception.ClassroomFailure;
import com.learnova.classroom.repository.*;
import com.learnova.identity.service.IdentityService;
import com.learnova.identity.service.ParticipantDirectory;
import com.learnova.shared.api.PageQuery;
import com.learnova.shared.api.PageResponse;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ClassroomService {
    private static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private final SecureRandom random = new SecureRandom();
    private final ClassroomRepository classrooms;
    private final MembershipRepository memberships;
    private final JoinCodeRepository codes;
    private final ClassroomQueries queries;
    private final IdentityService identity;
    private final ParticipantDirectory participants;
    private final AuditService audit;
    private final Clock clock;

    public ClassroomService(ClassroomRepository classrooms, MembershipRepository memberships, JoinCodeRepository codes,
            ClassroomQueries queries, IdentityService identity, ParticipantDirectory participants, AuditService audit, Clock clock) {
        this.classrooms = classrooms; this.memberships = memberships; this.codes = codes; this.queries = queries;
        this.identity = identity; this.participants = participants; this.audit = audit; this.clock = clock;
    }
    public PageResponse<OwnerSummary> owned(UUID actor, String search, PageQuery page) {
        requireRole(actor, "CREATOR");
        return queries.owned(actor, search, page, now());
    }
    public OwnerDetail detail(UUID actor, UUID id) { return detail(owner(actor, id, false)); }
    @Transactional
    public OwnerDetail create(UUID actor, WriteClassroom input) {
        requireRole(actor, "CREATOR");
        var c = classrooms.save(new Classroom(actor, input.name().strip(), description(input.description()), now()));
        record(actor, c.getId(), AuditAction.CLASSROOM_CREATED, Map.of());
        return detail(c);
    }
    @Transactional
    public OwnerDetail update(UUID actor, UUID id, WriteClassroom input) {
        var c = owner(actor, id, true);
        c.update(input.name().strip(), description(input.description()), now());
        record(actor, id, AuditAction.CLASSROOM_UPDATED, Map.of());
        return detail(c);
    }
    public ParticipantDirectory.Participant lookup(UUID actor, UUID id, String email) {
        owner(actor, id, false);
        if (!email.strip().matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new ClassroomFailure(400, "VALIDATION_FAILED");
        return participants.byEmail(email).orElseThrow(() -> new ClassroomFailure(404, "PARTICIPANT_NOT_FOUND"));
    }
    public PageResponse<Member> members(UUID actor, UUID id, String search, MembershipStatus status, PageQuery page) {
        owner(actor, id, false);
        return queries.members(id, search, status, page);
    }
    @Transactional
    public Membership add(UUID actor, UUID id, UUID userId) {
        owner(actor, id, true);
        participants.byId(userId).orElseThrow(() -> new ClassroomFailure(404, "PARTICIPANT_NOT_FOUND"));
        return activate(actor, id, userId, AuditAction.CLASSROOM_MEMBER_ADDED);
    }
    @Transactional
    public void remove(UUID actor, UUID id, UUID userId) {
        owner(actor, id, true);
        removeMembership(actor, id, userId, AuditAction.CLASSROOM_MEMBER_REMOVED);
    }
    @Transactional
    public JoinCodeView regenerate(UUID actor, UUID id) {
        owner(actor, id, true);
        String value;
        do {
            var builder = new StringBuilder(16);
            for (int i = 0; i < 16; i++) builder.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            value = builder.toString();
        } while (codes.existsByCode(value));
        var existing = codes.findById(id);
        var code = existing.orElse(null);
        if (code == null) code = codes.save(new ClassroomJoinCode(id, value, now()));
        else code.regenerate(value, now());
        record(actor, id, AuditAction.CLASSROOM_JOIN_CODE_GENERATED, Map.of());
        return codeView(code);
    }
    @Transactional
    public void revoke(UUID actor, UUID id) {
        owner(actor, id, true);
        codes.findById(id).filter(c -> c.getRevokedAt() == null).ifPresent(c -> {
            c.revoke(now());
            record(actor, id, AuditAction.CLASSROOM_JOIN_CODE_REVOKED, Map.of());
        });
    }
    public Preview preview(UUID actor, String raw) {
        requireRole(actor, "PARTICIPANT");
        var c = fromCode(raw, false);
        var membership = memberships.findByClassroomIdAndUserId(c.getId(), actor);
        return new Preview(c.getId(), c.getName(), c.getDescription(), queries.creatorName(c.getOwnerId()),
                membership.map(ClassroomMembership::getStatus).orElse(null));
    }
    @Transactional
    public Membership join(UUID actor, String raw) {
        requireRole(actor, "PARTICIPANT");
        var c = fromCode(raw, true);
        return activate(actor, c.getId(), actor, AuditAction.CLASSROOM_JOINED);
    }
    public PageResponse<ParticipantClassroom> joined(UUID actor, PageQuery page) {
        requireRole(actor, "PARTICIPANT");
        return queries.joined(actor, page);
    }
    @Transactional
    public void leave(UUID actor, UUID id) {
        requireRole(actor, "PARTICIPANT");
        classrooms.lockById(id).orElseThrow(() -> new ClassroomFailure(404, "CLASSROOM_NOT_FOUND"));
        removeMembership(actor, id, actor, AuditAction.CLASSROOM_LEFT);
    }
    private Classroom fromCode(String raw, boolean lock) {
        String value = raw.strip().toUpperCase(Locale.ROOT);
        UUID id = codes.findClassroomIdByCode(value).orElseThrow(this::invalidCode);
        var c = (lock ? classrooms.lockById(id) : classrooms.findById(id)).orElseThrow(this::invalidCode);
        // Sau khi khóa mới đọc mã hiện tại để không chấp nhận mã đã bị đổi/thu hồi trong lúc chờ.
        var current = codes.findById(id).orElseThrow(this::invalidCode);
        if (!current.getCode().equals(value) || !current.validAt(now())) throw invalidCode();
        return c;
    }
    private ClassroomFailure invalidCode() { return new ClassroomFailure(400, "JOIN_CODE_INVALID"); }
    private Membership activate(UUID actor, UUID id, UUID userId, AuditAction action) {
        var existing = memberships.findByClassroomIdAndUserId(id, userId);
        if (existing.isPresent() && existing.get().getStatus() == MembershipStatus.ACTIVE) return membership(existing.get());
        var member = existing.orElseGet(() -> memberships.save(new ClassroomMembership(id, userId, now())));
        member.changeStatus(MembershipStatus.ACTIVE, now());
        record(actor, id, action, Map.of("userId", userId.toString(), "membershipId", member.getId().toString(), "status", "ACTIVE"));
        return membership(member);
    }
    private void removeMembership(UUID actor, UUID id, UUID userId, AuditAction action) {
        var member = memberships.findByClassroomIdAndUserId(id, userId)
                .orElseThrow(() -> new ClassroomFailure(404, "MEMBERSHIP_NOT_FOUND"));
        if (member.getStatus() == MembershipStatus.REMOVED) return;
        member.changeStatus(MembershipStatus.REMOVED, now());
        record(actor, id, action, Map.of("userId", userId.toString(), "membershipId", member.getId().toString(), "status", "REMOVED"));
    }
    private Classroom owner(UUID actor, UUID id, boolean lock) {
        requireRole(actor, "CREATOR");
        var c = (lock ? classrooms.lockById(id) : classrooms.findById(id))
                .orElseThrow(() -> new ClassroomFailure(404, "CLASSROOM_NOT_FOUND"));
        if (!c.getOwnerId().equals(actor)) throw new ClassroomFailure(404, "CLASSROOM_NOT_FOUND");
        return c;
    }
    private void requireRole(UUID actor, String role) {
        if (!identity.activeUser(actor).roles().contains(role)) throw new ClassroomFailure(403, "FORBIDDEN");
    }
    private OwnerDetail detail(Classroom c) {
        return new OwnerDetail(c.getId(), c.getName(), c.getDescription(), queries.activeCount(c.getId()),
                codes.findById(c.getId()).map(this::codeView).orElse(new JoinCodeView("NOT_CREATED", null, null)), c.getCreatedAt(), c.getUpdatedAt());
    }
    private JoinCodeView codeView(ClassroomJoinCode c) {
        return new JoinCodeView(c.statusAt(now()), c.validAt(now()) ? c.getCode() : null, c.getExpiresAt());
    }
    private Membership membership(ClassroomMembership m) {
        return new Membership(m.getId(), m.getClassroomId(), m.getUserId(), m.getStatus(), m.getJoinedAt(), m.getUpdatedAt());
    }
    // PostgreSQL lưu tới microsecond; response lần đầu và retry phải giống nhau.
    private java.time.Instant now() { return clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS); }
    private String description(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private void record(UUID actor, UUID id, AuditAction action, Map<String, String> data) {
        audit.record(actor.toString(), action, "Classroom", id.toString(), data);
    }
}
