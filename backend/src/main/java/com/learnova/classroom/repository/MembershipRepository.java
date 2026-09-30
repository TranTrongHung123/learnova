package com.learnova.classroom.repository;

import com.learnova.classroom.entity.ClassroomMembership;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<ClassroomMembership, UUID> {
    Optional<ClassroomMembership> findByClassroomIdAndUserId(UUID classroomId, UUID userId);
}
