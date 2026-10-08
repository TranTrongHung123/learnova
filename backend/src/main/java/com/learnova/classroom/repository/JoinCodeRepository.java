package com.learnova.classroom.repository;

import com.learnova.classroom.entity.ClassroomJoinCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface JoinCodeRepository extends JpaRepository<ClassroomJoinCode, UUID> {
    // Chỉ đọc ID trước khi khóa lớp; không giữ entity mã cũ trong persistence context.
    @Query("select j.classroomId from ClassroomJoinCode j where j.code = :code")
    Optional<UUID> findClassroomIdByCode(String code);

    boolean existsByCode(String code);
}
