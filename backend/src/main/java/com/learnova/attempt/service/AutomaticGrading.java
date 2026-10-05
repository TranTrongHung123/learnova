package com.learnova.attempt.service;

import com.learnova.attempt.dto.AttemptDtos.Answer;
import com.learnova.exam.service.ExamService.GradingQuestion;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import org.springframework.stereotype.Service;

@Service
public class AutomaticGrading {
    public boolean correct(GradingQuestion q, Answer answer) {
        return switch (q.type()) {
            case "SINGLE_CHOICE" -> answer.optionIds().size() == 1
                    && new HashSet<>(answer.optionIds()).equals(q.correctOptions());
            case "MULTIPLE_CHOICE" -> !answer.optionIds().isEmpty()
                    && answer.optionIds().size() == new HashSet<>(answer.optionIds()).size()
                    && new HashSet<>(answer.optionIds()).equals(q.correctOptions());
            case "TRUE_FALSE" -> answer.booleanValue() != null && answer.booleanValue().equals(q.correctBoolean());
            case "NUMERIC_ANSWER" -> answer.numericValue() != null
                    && new BigDecimal(answer.numericValue()).subtract(q.correctValue()).abs().compareTo(q.tolerance()) <= 0;
            default -> throw new IllegalStateException("Unsupported published question type");
        };
    }

    public boolean passed(BigDecimal rawScore, BigDecimal passingScore) { return rawScore.compareTo(passingScore) >= 0; }
    public String display(BigDecimal score) { return score.setScale(2, RoundingMode.HALF_UP).toPlainString(); }
}
