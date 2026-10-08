package com.learnova.question.entity;

import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.enums.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.Getter;

@Entity
@Table(name = "questions")
@Getter
public class Question {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private QuestionStatus status;

    @Column(nullable = false, length = 10000)
    private String content;

    @Column(length = 10000)
    private String explanation;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Difficulty difficulty;

    @Column(length = 100)
    private String category;

    private Boolean correctBoolean;

    @Column(precision = 30, scale = 10)
    private BigDecimal correctValue;

    @Column(nullable = false, precision = 30, scale = 10)
    private BigDecimal tolerance;

    @Column(nullable = false)
    private long revision;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @ElementCollection
    @CollectionTable(name = "question_options", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "position")
    private List<AnswerOption> options = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "question_tags", joinColumns = @JoinColumn(name = "question_id"))
    @Column(name = "tag", length = 50)
    private Set<String> tags = new LinkedHashSet<>();

    protected Question() {}

    public Question(UUID ownerId, Instant now) {
        this.id = UUID.randomUUID();
        this.ownerId = ownerId;
        this.createdAt = now;
    }

    public void write(WriteQuestion input, BigDecimal value, BigDecimal tolerance, Instant now) {
        type = input.type();
        status = input.status();
        content = input.content() == null ? "" : input.content().strip();
        explanation = clean(input.explanation());
        category = clean(input.category());
        difficulty = input.difficulty();
        correctBoolean = input.correctBoolean();
        correctValue = value;
        this.tolerance = tolerance;
        options.clear();
        if (input.options() != null) input
            .options()
            .forEach(o ->
                options.add(
                    new AnswerOption(o.content() == null ? "" : o.content().strip(), o.correct())
                )
            );
        tags.clear();
        if (input.tags() != null) input.tags().forEach(t -> tags.add(t.strip()));
        updatedAt = now;
        revision++;
    }

    public void transition(QuestionStatus state, Instant now) {
        status = state;
        updatedAt = now;
        revision++;
    }

    private static String clean(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    @Embeddable
    @Getter
    public static class AnswerOption {

        @Column(nullable = false, length = 2000)
        private String content;

        @Column(nullable = false)
        private boolean correct;

        protected AnswerOption() {}

        public AnswerOption(String content, boolean correct) {
            this.content = content;
            this.correct = correct;
        }
    }
}
