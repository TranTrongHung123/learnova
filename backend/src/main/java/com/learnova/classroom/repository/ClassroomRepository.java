package com.learnova.classroom.repository;

import com.learnova.classroom.entity.Classroom;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface ClassroomRepository extends JpaRepository<Classroom, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Classroom c where c.id = :id")
    Optional<Classroom> lockById(UUID id);
}
