package com.learnova.question.repository;

import com.learnova.question.entity.Question;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

public interface QuestionRepository extends JpaRepository<Question, UUID>, JpaSpecificationExecutor<Question> {
    Optional<Question> findByIdAndOwnerId(UUID id, UUID ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from Question q where q.id = :id and q.ownerId = :ownerId")
    Optional<Question> lockOwned(UUID id, UUID ownerId);
}
