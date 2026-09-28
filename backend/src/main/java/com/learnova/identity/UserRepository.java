package com.learnova.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

interface UserRepository extends JpaRepository<User, UUID> {
    @EntityGraph(attributePaths = "roles")
    Optional<User> findByEmail(String email);
    @Override
    @EntityGraph(attributePaths = "roles")
    Optional<User> findById(UUID id);
}
