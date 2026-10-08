package com.learnova.exam.entity;

import com.learnova.exam.dto.ExamDtos.Snapshot;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "exam_version_questions")
@Getter
public class ExamVersionQuestion {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id")
    private ExamVersion version;

    @Column(nullable = false)
    private UUID sourceQuestionId;

    @Column(nullable = false)
    private long sourceRevision;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false, precision = 30, scale = 10)
    private BigDecimal points;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Snapshot snapshot;

    protected ExamVersionQuestion() {}

    public ExamVersionQuestion(
        ExamVersion version,
        UUID source,
        long revision,
        int position,
        BigDecimal points,
        Snapshot snapshot
    ) {
        id = UUID.randomUUID();
        this.version = version;
        sourceQuestionId = source;
        sourceRevision = revision;
        this.position = position;
        this.points = points;
        this.snapshot = snapshot;
    }

    public void configure(int position, BigDecimal points) {
        version.requireDraft();
        this.position = position;
        this.points = points;
    }
}
