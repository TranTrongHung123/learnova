package com.learnova.classroom.repository;

import com.learnova.classroom.dto.ClassroomDtos.*;
import com.learnova.classroom.enums.MembershipStatus;
import com.learnova.shared.api.PageQuery;
import com.learnova.shared.api.PageResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ClassroomQueries {
    private final NamedParameterJdbcTemplate jdbc;
    public ClassroomQueries(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public PageResponse<OwnerSummary> owned(UUID owner, String search, PageQuery page, Instant now) {
        var args = parameters(page).addValue("owner", owner).addValue("search", pattern(search)).addValue("now", java.sql.Timestamp.from(now));
        String from = " from classrooms c where c.owner_id=:owner and lower(c.name) like :search escape '!'";
        return page("select c.*, (select count(*) from classroom_memberships m where m.classroom_id=c.id and m.status='ACTIVE') as member_count, "
                + "(select case when j.revoked_at is not null then 'REVOKED' when j.expires_at<=:now then 'EXPIRED' else 'ACTIVE' end "
                + "from classroom_join_codes j where j.classroom_id=c.id) as code_status" + from + " order by c.updated_at desc, c.id",
                "select count(*)" + from, args, page,
                (r, n) -> new OwnerSummary(id(r, "id"), r.getString("name"), r.getString("description"), r.getLong("member_count"),
                        r.getString("code_status") == null ? "NOT_CREATED" : r.getString("code_status"), time(r, "updated_at")));
    }

    public PageResponse<ParticipantClassroom> joined(UUID user, PageQuery page) {
        var args = parameters(page).addValue("user", user);
        String from = " from classroom_memberships m join classrooms c on c.id=m.classroom_id join users u on u.id=c.owner_id "
                + "where m.user_id=:user and m.status='ACTIVE'";
        return page("select c.id,c.name,c.description,u.display_name,m.joined_at" + from + " order by m.joined_at desc, c.id",
                "select count(*)" + from, args, page,
                (r, n) -> new ParticipantClassroom(id(r, "id"), r.getString("name"), r.getString("description"), r.getString("display_name"), time(r, "joined_at")));
    }

    public PageResponse<Member> members(UUID classroom, String search, MembershipStatus status, PageQuery page) {
        var args = parameters(page).addValue("classroom", classroom).addValue("search", pattern(search));
        // Projection đọc tối thiểu tên/email; không import entity/repository của identity.
        String from = " from classroom_memberships m join users u on u.id=m.user_id where m.classroom_id=:classroom "
                + "and (lower(u.email) like :search escape '!' or lower(u.display_name) like :search escape '!')";
        if (status != null) { from += " and m.status=:status"; args.addValue("status", status.name()); }
        return page("select m.*,u.email,u.display_name" + from + " order by m.joined_at desc, m.id", "select count(*)" + from,
                args, page, (r, n) -> new Member(id(r, "id"), id(r, "user_id"), r.getString("email"), r.getString("display_name"),
                        MembershipStatus.valueOf(r.getString("status")), time(r, "joined_at"), time(r, "updated_at")));
    }

    public long activeCount(UUID classroom) {
        return jdbc.queryForObject("select count(*) from classroom_memberships where classroom_id=:id and status='ACTIVE'", Map.of("id", classroom), Long.class);
    }
    public String creatorName(UUID owner) {
        return jdbc.queryForObject("select display_name from users where id=:id", Map.of("id", owner), String.class);
    }
    private <T> PageResponse<T> page(String select, String count, MapSqlParameterSource args, PageQuery page, RowMapper<T> mapper) {
        long total = jdbc.queryForObject(count, args, Long.class);
        var rows = jdbc.query(select + " limit :limit offset :offset", args, mapper);
        return new PageResponse<>(rows, page.page(), page.size(), total, (int) Math.min(Integer.MAX_VALUE, (total + page.size() - 1) / page.size()));
    }
    private MapSqlParameterSource parameters(PageQuery page) {
        return new MapSqlParameterSource().addValue("limit", page.size()).addValue("offset", (long) page.page() * page.size());
    }
    private String pattern(String value) {
        return "%" + value.strip().toLowerCase(java.util.Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }
    private static UUID id(ResultSet r, String column) throws SQLException { return r.getObject(column, UUID.class); }
    private static Instant time(ResultSet r, String column) throws SQLException { return r.getTimestamp(column).toInstant(); }
}
