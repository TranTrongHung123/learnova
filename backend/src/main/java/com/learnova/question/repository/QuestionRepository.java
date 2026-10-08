package com.learnova.question.repository;

import com.learnova.question.entity.Question;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

public interface QuestionRepository
    extends JpaRepository<Question, UUID>, JpaSpecificationExecutor<Question>
{
    @Query(
        """
        select new com.learnova.question.dto.QuestionDtos$ExamCandidate(q.id, q.revision)
        from Question q where q.ownerId = :ownerId and q.status = com.learnova.question.enums.QuestionStatus.ACTIVE
        and (:category is null or lower(q.category) = :category)
        and (:difficulty is null or q.difficulty = :difficulty)
        and (:type is null or q.type = :type) order by q.id
        """
    )
    java.util.List<com.learnova.question.dto.QuestionDtos.ExamCandidate> examCandidates(
        UUID ownerId,
        String category,
        com.learnova.question.enums.Difficulty difficulty,
        com.learnova.question.enums.QuestionType type
    );

    Optional<Question> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from Question q where q.id = :id and q.ownerId = :ownerId")
    Optional<Question> lockOwned(UUID id, UUID ownerId);
}
