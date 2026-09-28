package com.learnova.identity.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id UUID id;
    @Column(nullable = false, unique = true, length = 254) String email;
    @Column(nullable = false, length = 100) String displayName;
    @Column(nullable = false, length = 16) String status;
    @Column(nullable = false) Instant createdAt;
    @Column(nullable = false) boolean onboardingCompleted = true;
    @ElementCollection
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role", nullable = false, length = 16)
    Set<String> roles = new HashSet<>();

    protected User() {}
    public User(String email, String displayName, Set<String> roles, Instant now) {
        id = UUID.randomUUID();
        this.email = email;
        this.displayName = displayName;
        this.roles.addAll(roles);
        status = "ACTIVE";
        createdAt = now;
    }

    public UUID getId() { return id; }

    public String getEmail() { return email; }

    public String getDisplayName() { return displayName; }

    public String getStatus() { return status; }

    public Set<String> getRoles() { return roles; }

    public boolean isOnboardingCompleted() { return onboardingCompleted; }

    public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }
}
