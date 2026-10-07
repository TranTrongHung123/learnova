package com.learnova.notification.repository;

import com.learnova.notification.dto.NotificationDtos.Item;
import com.learnova.shared.api.*;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationRepository {
    private final JdbcClient jdbc;
    public NotificationRepository(JdbcClient jdbc) { this.jdbc=jdbc; }
    public PageResponse<Item> list(UUID actor, boolean unread, PageQuery page) {
        String where=" where recipient_id=:actor"+(unread?" and read_at is null":"");
        long count=jdbc.sql("select count(*) from notifications"+where).param("actor",actor).query(Long.class).single();
        var items=jdbc.sql("select * from notifications"+where+" order by created_at desc,id desc limit :limit offset :offset")
            .param("actor",actor).param("limit",page.size()).param("offset",(long)page.page()*page.size())
            .query((rs,n)->new Item(rs.getObject("id",UUID.class),rs.getString("type"),rs.getString("title"),rs.getString("message"),
                rs.getString("target_path"),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("read_at")==null?null:rs.getTimestamp("read_at").toInstant())).list();
        return new PageResponse<>(items,page.page(),page.size(),count,(int)((count+page.size()-1)/page.size()));
    }
    public long unread(UUID actor) {
        return jdbc.sql("select count(*) from notifications where recipient_id=:actor and read_at is null").param("actor",actor).query(Long.class).single();
    }
    public boolean read(UUID actor, UUID id, Instant now) {
        return jdbc.sql("update notifications set read_at=coalesce(read_at,:now) where recipient_id=:actor and id=:id")
            .param("actor",actor).param("id",id).param("now",Timestamp.from(now)).update()>0;
    }
    public void readAll(UUID actor, Instant now) {
        jdbc.sql("update notifications set read_at=:now where recipient_id=:actor and read_at is null")
            .param("actor",actor).param("now",Timestamp.from(now)).update();
    }
}
