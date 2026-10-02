package com.learnova.question.service;

import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.enums.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.shared.api.ApiProblems.FieldError;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class QuestionValidation {
    public record Numbers(BigDecimal value, BigDecimal tolerance) {}
    public Numbers validate(WriteQuestion input) {
        return validate(input, input.status() == QuestionStatus.ACTIVE);
    }
    public Numbers validateComplete(WriteQuestion input) {
        return validate(input, true);
    }
    private Numbers validate(WriteQuestion input, boolean complete) {
        var errors = new ArrayList<FieldError>();
        if (input.type() == null) error(errors, "type", "Chọn loại câu hỏi.");
        if (input.status() == null || input.status() == QuestionStatus.ARCHIVED) error(errors, "status", "Chỉ được lưu DRAFT hoặc ACTIVE.");
        length(errors, "content", input.content(), 10000);
        length(errors, "explanation", input.explanation(), 10000);
        length(errors, "category", input.category(), 100);
        var tags = input.tags() == null ? List.<String>of() : input.tags();
        if (tags.size() > 20) error(errors, "tags", "Tối đa 20 nhãn.");
        for (String tag : tags) {
            if (tag == null || tag.isBlank() || tag.length() > 50) error(errors, "tags", "Mỗi nhãn cần 1–50 ký tự.");
        }
        var options = input.options() == null ? List.<Option>of() : input.options();
        if (options.size() > 20) error(errors, "options", "Tối đa 20 lựa chọn.");
        for (int i = 0; i < options.size(); i++) {
            var option = options.get(i);
            if (option == null) error(errors, "options", "Lựa chọn không hợp lệ.");
            else length(errors, "options[" + i + "].content", option.content(), 2000);
        }
        var value = decimal(errors, "correctValue", input.correctValue());
        var tolerance = decimal(errors, "tolerance", input.tolerance());
        if (tolerance == null) tolerance = BigDecimal.ZERO;
        if (tolerance.signum() < 0) error(errors, "tolerance", "Sai số không được âm.");
        if (input.type() != QuestionType.NUMERIC_ANSWER && (input.correctValue() != null || tolerance.signum() != 0))
            error(errors, "correctValue", "Đáp án số chỉ dùng cho NUMERIC_ANSWER.");
        if (input.type() != QuestionType.TRUE_FALSE && input.correctBoolean() != null)
            error(errors, "correctBoolean", "Đáp án đúng/sai chỉ dùng cho TRUE_FALSE.");
        boolean choice = input.type() == QuestionType.SINGLE_CHOICE || input.type() == QuestionType.MULTIPLE_CHOICE;
        if (!choice && !options.isEmpty()) error(errors, "options", "Loại câu hỏi này không có lựa chọn tùy biến.");
        if (complete) {
            if (input.content() == null || input.content().isBlank()) error(errors, "content", "Nhập nội dung trước khi kích hoạt.");
            if (choice) {
                if (options.size() < 2) error(errors, "options", "Cần ít nhất hai lựa chọn.");
                long correct = options.stream().filter(Objects::nonNull).filter(Option::correct).count();
                if (correct == 0 || (input.type() == QuestionType.SINGLE_CHOICE && correct != 1))
                    error(errors, "options", input.type() == QuestionType.SINGLE_CHOICE ? "Chọn đúng một đáp án đúng." : "Chọn ít nhất một đáp án đúng.");
                for (int i = 0; i < options.size(); i++) {
                    if (options.get(i) != null && (options.get(i).content() == null || options.get(i).content().isBlank()))
                        error(errors, "options[" + i + "].content", "Nhập nội dung lựa chọn.");
                }
            }
            if (input.type() == QuestionType.TRUE_FALSE && input.correctBoolean() == null) error(errors, "correctBoolean", "Chọn đáp án đúng hoặc sai.");
            if (input.type() == QuestionType.NUMERIC_ANSWER && value == null) error(errors, "correctValue", "Nhập đáp án số.");
        }
        if (!errors.isEmpty()) throw new QuestionFailure(400, "VALIDATION_FAILED", errors);
        return new Numbers(value, tolerance);
    }
    private BigDecimal decimal(List<FieldError> errors, String field, String raw) {
        if (raw == null) return null;
        if (raw.length() > 42 || !raw.matches("-?\\d+(\\.\\d+)?")) {
            error(errors, field, "Nhập số thập phân dùng dấu chấm, không dùng ký hiệu mũ."); return null;
        }
        var value = new BigDecimal(raw);
        if (value.scale() > 10 || value.precision() - value.scale() > 20)
            error(errors, field, "Tối đa 20 chữ số phần nguyên và 10 chữ số thập phân.");
        return value;
    }
    private void length(List<FieldError> errors, String field, String value, int max) {
        if (value != null && value.length() > max) error(errors, field, "Tối đa " + max + " ký tự.");
    }
    private void error(List<FieldError> errors, String field, String message) { errors.add(new FieldError(field, message)); }
}
