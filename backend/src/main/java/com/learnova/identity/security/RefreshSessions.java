package com.learnova.identity.security;

import com.learnova.identity.exception.AuthFailure;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class RefreshSessions {

    private static final String PREFIX = "auth:";
    private static final Duration LIFETIME = Duration.ofDays(7);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final StringRedisTemplate redis;
    private final Clock clock;

    public RefreshSessions(StringRedisTemplate redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    public record Session(UUID userId, String sessionId, String familyId, Instant expiresAt) {}

    public record Issued(String token, Session session) {
        @Override
        public String toString() {
            return "Issued[redacted]";
        }
    }

    public Issued create(UUID userId) {
        String token = randomToken();
        String id = UUID.randomUUID().toString();
        var session = new Session(
            userId,
            id,
            UUID.randomUUID().toString(),
            clock.instant().plus(LIFETIME)
        );
        run(
            """
            redis.call('HSET', KEYS[1], 'userId', ARGV[1], 'sessionId', ARGV[2],
                'familyId', ARGV[3], 'expiresAt', ARGV[4], 'status', 'ACTIVE', 'createdAt', ARGV[5])
            redis.call('PEXPIREAT', KEYS[1], ARGV[4])
            redis.call('SET', KEYS[2], 'ACTIVE', 'PXAT', ARGV[4])
            redis.call('ZADD', KEYS[3], ARGV[4], KEYS[2])
            redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[5])
            local last = redis.call('ZREVRANGE', KEYS[3], 0, 0, 'WITHSCORES')
            redis.call('PEXPIREAT', KEYS[3], last[2])
            return 1
            """,
            List.of(tokenKey(token), sessionKey(id), userKey(userId)),
            userId.toString(),
            id,
            session.familyId(),
            millis(session.expiresAt()),
            millis(clock.instant())
        );
        return new Issued(token, session);
    }

    public Session lookup(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        var row = redis.opsForHash().entries(tokenKey(token));
        if (row.isEmpty()) throw invalid();
        var session = new Session(
            UUID.fromString((String) row.get("userId")),
            (String) row.get("sessionId"),
            (String) row.get("familyId"),
            Instant.ofEpochMilli(Long.parseLong((String) row.get("expiresAt")))
        );
        if (!session.expiresAt().isAfter(clock.instant())) throw invalid();
        return session;
    }

    public Issued rotate(String oldToken, Session session) {
        String token = randomToken();
        // Script kiểm tra lại trạng thái sau lookup; lookup không cấp quyền rotate.
        long result = run(
            """
            if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[3]) == 0 then return 0 end
            if tonumber(redis.call('HGET', KEYS[1], 'expiresAt')) <= tonumber(ARGV[1]) then return 0 end
            if redis.call('HGET', KEYS[1], 'status') ~= 'ACTIVE' then
                redis.call('DEL', KEYS[3])
                redis.call('ZREM', KEYS[4], KEYS[3])
                return -1
            end
            local values = redis.call('HGETALL', KEYS[1])
            redis.call('HSET', KEYS[2], unpack(values))
            redis.call('HSET', KEYS[2], 'createdAt', ARGV[1])
            redis.call('PEXPIREAT', KEYS[2], redis.call('HGET', KEYS[1], 'expiresAt'))
            redis.call('HSET', KEYS[1], 'status', 'USED')
            return 1
            """,
            List.of(
                tokenKey(oldToken),
                tokenKey(token),
                sessionKey(session.sessionId()),
                userKey(session.userId())
            ),
            millis(clock.instant())
        );
        if (result != 1) throw new AuthFailure(
            401,
            result == -1 ? "REFRESH_REUSED" : "INVALID_REFRESH_TOKEN"
        );
        return new Issued(token, session);
    }

    public void revoke(Session session) {
        run(
            "redis.call('DEL', KEYS[1]); redis.call('ZREM', KEYS[2], KEYS[1]); return 1",
            List.of(sessionKey(session.sessionId()), userKey(session.userId()))
        );
    }

    public void revokeAll(UUID userId) {
        run(
            """
            local sessions = redis.call('ZRANGE', KEYS[1], 0, -1)
            for _, key in ipairs(sessions) do redis.call('DEL', key) end
            redis.call('DEL', KEYS[1])
            return 1
            """,
            List.of(userKey(userId))
        );
    }

    public void revokeOthers(UUID userId, String currentSessionId) {
        if (
            currentSessionId == null || !currentSessionId.matches("[0-9a-f-]{36}")
        ) throw new AuthFailure(401, "AUTHENTICATION_REQUIRED");
        // Membership và expiry được kiểm tra trong cùng script với revoke, không thể phục hồi session đã mất.
        long result = run(
            """
            local expiry = redis.call('ZSCORE', KEYS[1], KEYS[2])
            if not expiry or tonumber(expiry) <= tonumber(ARGV[1])
                or redis.call('EXISTS', KEYS[2]) == 0 then return 0 end
            local sessions = redis.call('ZRANGE', KEYS[1], 0, -1)
            for _, key in ipairs(sessions) do
                if key ~= KEYS[2] then
                    redis.call('DEL', key)
                    redis.call('ZREM', KEYS[1], key)
                end
            end
            redis.call('PEXPIREAT', KEYS[1], expiry)
            return 1
            """,
            List.of(userKey(userId), sessionKey(currentSessionId)),
            millis(clock.instant())
        );
        if (result != 1) throw new AuthFailure(401, "AUTHENTICATION_REQUIRED");
    }

    private long run(String script, List<String> keys, String... arguments) {
        Long result = redis.execute(
            new DefaultRedisScript<>(script, Long.class),
            keys,
            (Object[]) arguments
        );
        if (result == null) throw new IllegalStateException("Missing Redis result");
        return result;
    }

    private static String millis(Instant time) {
        return Long.toString(time.toEpochMilli());
    }

    private static String sessionKey(String id) {
        return PREFIX + "session:" + id;
    }

    private static String userKey(UUID id) {
        return PREFIX + "user:" + id;
    }

    private static String tokenKey(String token) {
        try {
            return (
                PREFIX +
                "token:" +
                HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(
                        token.getBytes(StandardCharsets.UTF_8)
                    )
                )
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static AuthFailure invalid() {
        return new AuthFailure(401, "INVALID_REFRESH_TOKEN");
    }
}
