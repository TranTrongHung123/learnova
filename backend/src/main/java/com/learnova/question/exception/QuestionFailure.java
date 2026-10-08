package com.learnova.question.exception;

import com.learnova.shared.api.ApiProblems.FieldError;
import java.util.List;

public class QuestionFailure extends RuntimeException {

    public final int status;
    public final String code;
    public final List<FieldError> fields;

    public QuestionFailure(int status, String code) {
        this(status, code, List.of());
    }

    public QuestionFailure(int status, String code, List<FieldError> fields) {
        super(code);
        this.status = status;
        this.code = code;
        this.fields = List.copyOf(fields);
    }
}
