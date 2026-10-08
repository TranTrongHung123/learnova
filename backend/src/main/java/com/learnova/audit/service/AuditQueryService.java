package com.learnova.audit.service;

import com.learnova.audit.dto.AuditDtos.Item;
import com.learnova.audit.enums.AuditAction;
import com.learnova.shared.api.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class AuditQueryService {

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public AuditQueryService(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public PageResponse<Item> list(
        String actor,
        AuditAction action,
        String targetType,
        String targetId,
        Instant from,
        Instant to,
        PageQuery page
    ) {
        String where = " where true";
        var params = new HashMap<String, Object>();
        if (actor != null) {
            where += " and actor_user_id=:actor";
            params.put("actor", actor);
        }
        if (action != null) {
            where += " and action=:action";
            params.put("action", action.name());
        }
        if (targetType != null) {
            where += " and target_type=:targetType";
            params.put("targetType", targetType);
        }
        if (targetId != null) {
            where += " and target_id=:targetId";
            params.put("targetId", targetId);
        }
        if (from != null) {
            where += " and occurred_at>=:from";
            params.put("from", Timestamp.from(from));
        }
        if (to != null) {
            where += " and occurred_at<:to";
            params.put("to", Timestamp.from(to));
        }
        long count = jdbc
            .sql("select count(*) from audit_records" + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", page.size());
        params.put("offset", (long) page.page() * page.size());
        var items = jdbc
            .sql(
                "select id,actor_user_id,action,target_type,target_id,metadata,occurred_at from audit_records" +
                    where +
                    " order by occurred_at desc,id desc limit :limit offset :offset"
            )
            .params(params)
            .query((rs, n) -> {
                var event = AuditAction.valueOf(rs.getString("action"));
                return new Item(
                    rs.getObject("id", UUID.class),
                    rs.getString("actor_user_id"),
                    event,
                    rs.getString("target_type"),
                    rs.getString("target_id"),
                    safeMetadata(event, rs.getString("metadata")),
                    rs.getTimestamp("occurred_at").toInstant()
                );
            })
            .list();
        return new PageResponse<>(
            items,
            page.page(),
            page.size(),
            count,
            (int) ((count + page.size() - 1) / page.size())
        );
    }

    private Map<String, String> safeMetadata(AuditAction action, String json) {
        // Chỉ công bố key theo từng action; payload cũ hoặc field mới không tự lọt vào API.
        Set<String> keys = switch (action) {
            case ADMIN_BOOTSTRAPPED -> Set.of("newRoles");
            case ROLE_CHANGED -> Set.of("oldRoles", "newRoles");
            case ACCOUNT_LOCKED, ACCOUNT_UNLOCKED -> Set.of("oldStatus", "newStatus");
            case EXAM_VERSION_CREATED, EXAM_VERSION_PUBLISHED -> Set.of("version");
            case QUESTION_CREATED, QUESTION_UPDATED, QUESTION_ARCHIVED, QUESTION_RESTORED -> Set.of(
                "status",
                "revision"
            );
            case QUESTIONS_IMPORTED -> Set.of("importedRows", "skippedRows");
            case
                CLASSROOM_MEMBER_ADDED,
                CLASSROOM_MEMBER_REMOVED,
                CLASSROOM_JOINED,
                CLASSROOM_LEFT -> Set.of("userId", "membershipId", "status");
            case SESSION_END_TIME_EXTENDED -> Set.of("oldEndTime", "newEndTime");
            default -> Set.of();
        };
        var node = mapper.readTree(json);
        var result = new LinkedHashMap<String, String>();
        keys.stream()
            .sorted()
            .forEach(key -> {
                if (node.has(key) && node.get(key).isString()) result.put(
                    key,
                    node.get(key).asString()
                );
            });
        return result;
    }
}
