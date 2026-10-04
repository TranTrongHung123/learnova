package com.learnova.session;

import com.learnova.session.service.DiscoveryService;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

// Chỉ có trên test classpath và cần bật cờ riêng; không đóng gói trong ứng dụng.
@RestController
@ConditionalOnProperty(name="learnova.test.discovery",havingValue="true")
class DiscoveryFixtureController {
    private final JdbcTemplate jdbc;
    private final DiscoveryService discovery;
    DiscoveryFixtureController(JdbcTemplate jdbc,DiscoveryService discovery) { this.jdbc=jdbc; this.discovery=discovery; }
    @PostMapping("/api/v1/exam-sessions/{id}/test-fixture")
    UUID seed(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestParam String status) {
        var actor=UUID.fromString(jwt.getSubject()); discovery.detail(actor,id);
        if (!java.util.Set.of("IN_PROGRESS","SUBMITTED","EXPIRED","GRADED").contains(status)) throw new IllegalArgumentException();
        UUID attempt=UUID.randomUUID();
        jdbc.update("""
            insert into attempts(id,participant_id,session_id,exam_version_id,attempt_number,status,started_at,deadline,submitted_at)
            select ?,?,s.id,s.exam_version_id,(select count(*)+1 from attempts a where a.session_id=s.id and a.participant_id=?),?,
            now(),least(now()+interval '15 minutes',s.end_time),case when ?='IN_PROGRESS' then null else now() end
            from exam_sessions s where s.id=?
            """,attempt,actor,actor,status,status,id);
        jdbc.update("update exam_sessions set first_attempt_at=coalesce(first_attempt_at,now()) where id=?",id);
        return attempt;
    }
}
