package com.learnova.attempt;

import static org.assertj.core.api.Assertions.*;

import com.learnova.attempt.dto.AttemptDtos.Answer;
import com.learnova.attempt.service.AutomaticGrading;
import com.learnova.exam.service.ExamService.GradingQuestion;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AutomaticGradingTests {

    private final AutomaticGrading grading = new AutomaticGrading();
    private final UUID a = UUID.randomUUID(),
        b = UUID.randomUUID(),
        c = UUID.randomUUID();

    private GradingQuestion question(
        String type,
        Set<UUID> options,
        Boolean bool,
        String value,
        String tolerance
    ) {
        return new GradingQuestion(
            UUID.randomUUID(),
            type,
            new BigDecimal("1.005"),
            options,
            bool,
            value == null ? null : new BigDecimal(value),
            new BigDecimal(tolerance)
        );
    }

    @Test
    void singleChoiceRequiresExactlyOneCorrectOption() {
        var q = question("SINGLE_CHOICE", Set.of(a), null, null, "0");
        assertThat(grading.correct(q, new Answer(List.of(a), null, null))).isTrue();
        for (var options : List.of(List.<UUID>of(), List.of(b), List.of(a, b), List.of(a, a)))
            assertThat(grading.correct(q, new Answer(options, null, null))).isFalse();
    }

    @Test
    void multipleChoiceUsesExactSetAndIgnoresOrder() {
        var q = question("MULTIPLE_CHOICE", Set.of(a, b), null, null, "0");
        assertThat(grading.correct(q, new Answer(List.of(b, a), null, null))).isTrue();
        for (var options : List.of(List.<UUID>of(), List.of(a), List.of(a, b, c), List.of(a, a, b)))
            assertThat(grading.correct(q, new Answer(options, null, null))).isFalse();
    }

    @Test
    void falseIsAnAnswerButNullIsNot() {
        var q = question("TRUE_FALSE", Set.of(), false, null, "0");
        assertThat(grading.correct(q, new Answer(List.of(), false, null))).isTrue();
        assertThat(grading.correct(q, new Answer(List.of(), true, null))).isFalse();
        assertThat(grading.correct(q, Answer.empty())).isFalse();
    }

    @Test
    void numericUsesInclusiveAbsoluteToleranceWithFullPrecision() {
        var q = question("NUMERIC_ANSWER", Set.of(), null, "-2.5", "0.1");
        for (var value : List.of("-2.5", "-2.60", "-2.4"))
            assertThat(grading.correct(q, new Answer(List.of(), null, value))).isTrue();
        for (var value : List.of("-2.6000000001", "-2.3999999999", "2.5"))
            assertThat(grading.correct(q, new Answer(List.of(), null, value))).isFalse();
        assertThat(grading.correct(q, Answer.empty())).isFalse();
        var exact = question("NUMERIC_ANSWER", Set.of(), null, "0", "0");
        assertThat(grading.correct(exact, new Answer(List.of(), null, "-0.000"))).isTrue();
        assertThat(grading.correct(exact, new Answer(List.of(), null, "0.0000000001"))).isFalse();
    }

    @Test
    void roundingDoesNotChangePassFail() {
        assertThat(grading.display(new BigDecimal("0.995"))).isEqualTo("1.00");
        assertThat(grading.passed(new BigDecimal("0.995"), BigDecimal.ONE)).isFalse();
        assertThat(grading.passed(new BigDecimal("1.000"), BigDecimal.ONE)).isTrue();
        assertThat(grading.display(new BigDecimal("1.004"))).isEqualTo("1.00");
        assertThat(grading.display(new BigDecimal("1.005"))).isEqualTo("1.01");
    }
}
