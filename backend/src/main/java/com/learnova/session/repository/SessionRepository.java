package com.learnova.session.repository;

import com.learnova.session.entity.ExamSession;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

public interface SessionRepository extends JpaRepository<ExamSession, UUID>, JpaSpecificationExecutor<ExamSession> {
    Optional<ExamSession> findByIdAndOwnerId(UUID id, UUID ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ExamSession s where s.id=:id")
    Optional<ExamSession> lockById(UUID id);
    @Query("select s.id from ExamSession s where (s.status=com.learnova.session.enums.SessionStatus.SCHEDULED and s.startTime<=:now) or (s.status=com.learnova.session.enums.SessionStatus.OPEN and s.endTime<=:now) order by s.endTime,s.id")
    List<UUID> due(Instant now, Pageable page);
}
