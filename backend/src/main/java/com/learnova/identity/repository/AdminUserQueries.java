package com.learnova.identity.repository;

import com.learnova.identity.dto.AdminUserDtos.Detail;
import com.learnova.shared.api.PageQuery;
import com.learnova.shared.api.PageResponse;
import java.util.Arrays;
import java.util.HashMap;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AdminUserQueries {
    private final JdbcClient jdbc;
    public AdminUserQueries(JdbcClient jdbc) { this.jdbc = jdbc; }

    public PageResponse<Detail> list(String search, String role, String status, PageQuery page) {
        String where = " where true";
        var params = new HashMap<String, Object>();
        if (search != null && !search.isBlank()) {
            where += " and (strpos(lower(u.email),:search)>0 or strpos(lower(u.display_name),:search)>0)";
            params.put("search", search.strip().toLowerCase(java.util.Locale.ROOT));
        }
        if (role != null) {
            where += " and exists(select 1 from user_roles r where r.user_id=u.id and r.role=:role)";
            params.put("role", role);
        }
        if (status != null) { where += " and u.status=:status"; params.put("status", status); }
        long count = jdbc.sql("select count(*) from users u" + where).params(params).query(Long.class).single();
        params.put("limit", page.size()); params.put("offset", (long) page.page() * page.size());
        var items = jdbc.sql("""
                select u.id,u.email,u.display_name,u.status,u.created_at,u.onboarding_completed,
                    array(select role from user_roles r where r.user_id=u.id order by role) as roles
                from users u
                """ + where + " order by u.created_at desc,u.id desc limit :limit offset :offset")
                .params(params).query((rs, n) -> new Detail(rs.getObject("id", UUID.class), rs.getString("email"),
                        rs.getString("display_name"), rs.getString("status"),
                        Arrays.asList((String[]) rs.getArray("roles").getArray()), rs.getTimestamp("created_at").toInstant(),
                        rs.getBoolean("onboarding_completed"))).list();
        return new PageResponse<>(items, page.page(), page.size(), count, (int) ((count + page.size() - 1) / page.size()));
    }
}
