package com.learnova.classroom.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

@Entity
@Table(name = "classrooms")
@Getter
public class Classroom {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Classroom() {}

    public Classroom(UUID ownerId, String name, String description, Instant now) {
        id = UUID.randomUUID();
        this.ownerId = ownerId;
        createdAt = now;
        update(name, description, now);
    }

    public void update(String name, String description, Instant now) {
        this.name = name;
        this.description = description;
        updatedAt = now;
    }
}
