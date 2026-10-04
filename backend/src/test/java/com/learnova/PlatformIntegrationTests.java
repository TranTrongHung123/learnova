package com.learnova;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import({TestcontainersConfiguration.class, PlatformIntegrationTests.FixedTime.class})
@SpringBootTest
class PlatformIntegrationTests {
    private static final Instant NOW = Instant.parse("2026-09-26T10:00:00Z");

    @Autowired AuditService audit;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired Flyway flyway;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired StringRedisTemplate redis;
    @Autowired ApplicationContext context;

    @BeforeEach
    void prepareBusinessFixture() {
        // Bảng fixture chỉ nằm trong database Testcontainers; không phải schema nghiệp vụ V1.
        jdbc.execute("CREATE TABLE IF NOT EXISTS test_business_changes (id uuid PRIMARY KEY)");
    }

    @Test
    void contextValidatesMigratedPostgres17SchemaWithoutGeneratedUser() {
        assertThat(jdbc.queryForObject("SHOW server_version", String.class)).startsWith("17.");
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("11");
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(entityManagerFactory.isOpen()).isTrue();
        assertThat(context.getBeansOfType(UserDetailsService.class)).isEmpty();
    }

    @Test
    void redisIsConnected() {
        try (var connection = redis.getConnectionFactory().getConnection()) {
            assertThat(connection.ping()).isEqualTo("PONG");
        }
    }

    @Test
    void auditAndBusinessChangeCommitTogether() {
        var target = UUID.randomUUID();
        UUID auditId = transaction().execute(status -> {
            insertBusinessChange(target);
            return audit.record("creator-1", AuditAction.SESSION_CREATED, "EXAM_SESSION",
                    target.toString(), Map.of("accessType", "PUBLIC"));
        });
        assertThat(businessCount(target)).isEqualTo(1);
        assertThat(auditCount(target)).isEqualTo(1);
        var row = jdbc.queryForMap("SELECT * FROM audit_records WHERE id = ?", auditId);
        assertThat(row.get("actor_user_id")).isEqualTo("creator-1");
        assertThat(row.get("action")).isEqualTo("SESSION_CREATED");
        Instant occurredAt = jdbc.queryForObject("SELECT occurred_at FROM audit_records WHERE id = ?",
                (rs, index) -> rs.getTimestamp(1).toInstant(), auditId);
        assertThat(occurredAt).isEqualTo(NOW);
        assertThat(jdbc.queryForObject("SELECT metadata ->> 'accessType' FROM audit_records WHERE id = ?",
                String.class, auditId)).isEqualTo("PUBLIC");
    }

    @Test
    void businessFailureRollsBackAudit() {
        var target = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            insertBusinessChange(target);
            audit.record(null, AuditAction.SESSION_CREATED, "EXAM_SESSION", target.toString(), Map.of());
            throw new IllegalStateException("business failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(businessCount(target)).isZero();
        assertThat(auditCount(target)).isZero();
    }

    @Test
    void auditDatabaseFailureRollsBackBusinessChange() {
        var target = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            insertBusinessChange(target);
            audit.record("creator-1", AuditAction.SESSION_CREATED, "EXAM_SESSION",
                    "x".repeat(129), Map.of());
        })).isInstanceOf(RuntimeException.class);
        assertThat(businessCount(target)).isZero();
    }

    @Test
    void caughtAuditFailureStillMarksTransactionForRollback() {
        var target = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            insertBusinessChange(target);
            try {
                audit.record("creator-1", null, "EXAM_SESSION", target.toString(), Map.of());
            } catch (IllegalArgumentException ignored) {
                // Chứng minh caller không thể nuốt lỗi audit rồi commit thay đổi nghiệp vụ.
            }
        })).isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);
        assertThat(businessCount(target)).isZero();
    }

    @Test
    void auditOutsideBusinessTransactionIsRejected() {
        var target = UUID.randomUUID();
        assertThatThrownBy(() -> audit.record(null, AuditAction.SESSION_CREATED,
                "EXAM_SESSION", target.toString(), Map.of()))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertThat(auditCount(target)).isZero();
    }

    private TransactionTemplate transaction() {
        return new TransactionTemplate(transactionManager);
    }

    private void insertBusinessChange(UUID target) {
        jdbc.update("INSERT INTO test_business_changes (id) VALUES (?)", target);
    }

    private int businessCount(UUID target) {
        return jdbc.queryForObject("SELECT count(*) FROM test_business_changes WHERE id = ?", Integer.class, target);
    }

    private int auditCount(UUID target) {
        return jdbc.queryForObject("SELECT count(*) FROM audit_records WHERE target_id = ?", Integer.class, target.toString());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedTime {
        @Bean
        @Primary
        Clock testClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }
}
