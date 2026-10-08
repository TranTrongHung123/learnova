package com.learnova.exam.repository;

import com.learnova.exam.entity.Exam;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ExamRepository extends JpaRepository<Exam, UUID>, JpaSpecificationExecutor<Exam> {
    Optional<Exam> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Exam e where e.id = :id and e.ownerId = :owner")
    Optional<Exam> lockOwned(UUID id, UUID owner);
}
