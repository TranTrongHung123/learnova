package com.learnova.exam.entity;

import com.learnova.exam.enums.ExamStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

@Entity
@Table(name = "exams")
@Getter
public class Exam {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 5000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ExamStatus status;

    @Column(nullable = false)
    private long revision;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Exam() {}

    public Exam(UUID owner, String name, String description, Instant now) {
        id = UUID.randomUUID();
        ownerId = owner;
        this.name = name.strip();
        this.description =
            description == null || description.isBlank() ? null : description.strip();
        status = ExamStatus.ACTIVE;
        createdAt = now;
        updatedAt = now;
    }

    public void touch(Instant now) {
        revision++;
        updatedAt = now;
    }

    public void archive(Instant now) {
        status = ExamStatus.ARCHIVED;
        touch(now);
    }
}
