package com.learnova.session.repository;

import com.learnova.session.dto.SessionDtos.Target;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SessionViews {
    private final JdbcClient jdbc;
    public SessionViews(JdbcClient jdbc) { this.jdbc=jdbc; }
    public record Version(UUID examId, String examName, int versionNumber, int questionCount, String totalScore) {}
    public Version version(UUID id) {
        return jdbc.sql("""
                select e.id, e.name, v.version_number, count(q.id) question_count, coalesce(sum(q.points),0) total_score
                from exam_versions v join exams e on e.id=v.exam_id
                left join exam_version_questions q on q.version_id=v.id where v.id=:id
                group by e.id,e.name,v.version_number
                """).param("id",id).query((r,n)->new Version(r.getObject("id",UUID.class),r.getString("name"),r.getInt("version_number"),
                        r.getInt("question_count"),r.getBigDecimal("total_score").stripTrailingZeros().toPlainString())).single();
    }
    public List<Target> classes(UUID id) {
        return jdbc.sql("select c.id,c.name from classrooms c join session_class_assignments a on a.classroom_id=c.id where a.session_id=:id order by c.name,c.id")
                .param("id",id).query((r,n)->new Target(r.getObject("id",UUID.class),r.getString("name"))).list();
    }
    public List<Target> participants(UUID id) {
        return jdbc.sql("select u.id,u.display_name from users u join session_individual_assignments a on a.user_id=u.id where a.session_id=:id order by u.display_name,u.id")
                .param("id",id).query((r,n)->new Target(r.getObject("id",UUID.class),r.getString("display_name"))).list();
    }
    public long classParticipantCount(UUID id) {
        return jdbc.sql("""
                select count(distinct m.user_id) from classroom_memberships m
                join session_class_assignments a on a.classroom_id=m.classroom_id
                where a.session_id=:id and m.status='ACTIVE'
                """).param("id",id).query(Long.class).single();
    }
}
