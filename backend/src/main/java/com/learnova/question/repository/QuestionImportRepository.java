package com.learnova.question.repository;

import com.learnova.question.dto.QuestionImportDtos.Row;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Repository
public class QuestionImportRepository {

    public record Batch(
        UUID id,
        String status,
        Instant expiresAt,
        Instant confirmedAt,
        int total,
        int valid,
        List<Row> rows
    ) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public QuestionImportRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void insert(UUID id, UUID owner, Instant now, Instant expiry, List<Row> rows) {
        jdbc.update(
            "insert into question_imports(id,owner_id,status,created_at,expires_at,total_rows,valid_rows,payload) values (?,?,'READY',?,?,?,?,?::jsonb)",
            id,
            owner,
            Timestamp.from(now),
            Timestamp.from(expiry),
            rows.size(),
            (int) rows.stream().filter(Row::valid).count(),
            mapper.writeValueAsString(rows)
        );
    }

    public Optional<Batch> owned(UUID id, UUID owner, boolean lock) {
        return jdbc
            .query(
                "select * from question_imports where id=? and owner_id=?" +
                    (lock ? " for update" : ""),
                (rs, index) -> {
                    String payload = rs.getString("payload");
                    Timestamp confirmed = rs.getTimestamp("confirmed_at");
                    return new Batch(
                        id,
                        rs.getString("status"),
                        rs.getTimestamp("expires_at").toInstant(),
                        confirmed == null ? null : confirmed.toInstant(),
                        rs.getInt("total_rows"),
                        rs.getInt("valid_rows"),
                        payload == null
                            ? List.of()
                            : mapper.readValue(payload, new TypeReference<List<Row>>() {})
                    );
                },
                id,
                owner
            )
            .stream()
            .findFirst();
    }

    public void confirmed(UUID id, Instant now) {
        jdbc.update(
            "update question_imports set status='CONFIRMED',confirmed_at=? where id=?",
            Timestamp.from(now),
            id
        );
    }

    public int cleanup(Instant now) {
        // SKIP LOCKED tránh tranh chấp với confirm đang tạo câu hỏi trong cùng transaction.
        return jdbc.update(
            """
            with expired as (select id from question_imports where expires_at<=? and payload is not null
                order by expires_at limit 100 for update skip locked)
            update question_imports q set payload=null,status=case when status='READY' then 'EXPIRED' else status end
            from expired e where q.id=e.id
            """,
            Timestamp.from(now)
        );
    }
}
