package com.learnova.exam.repository;

import com.learnova.exam.entity.ExamVersion;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ExamVersionRepository extends JpaRepository<ExamVersion, UUID> {
    @Query("select v.examId from ExamVersion v where v.id = :id")
    Optional<UUID> examId(UUID id);

    List<ExamVersion> findByExamIdOrderByVersionNumberDesc(UUID examId);
    Optional<ExamVersion> findFirstByExamIdOrderByVersionNumberDesc(UUID examId);
    Optional<ExamVersion> findByIdAndExamId(UUID id, UUID examId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from ExamVersion v where v.id = :id")
    Optional<ExamVersion> lockById(UUID id);
}
