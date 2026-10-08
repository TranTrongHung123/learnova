package com.learnova.exam.exception;

import com.learnova.exam.dto.ExamDtos.MatrixPreview;
import com.learnova.shared.api.ApiProblems.FieldError;
import java.util.List;

public class ExamFailure extends RuntimeException {

    public final int status;
    public final String code;
    public final List<FieldError> fields;
    public final MatrixPreview availability;

    public ExamFailure(int status, String code) {
        this(status, code, List.of());
    }

    public ExamFailure(int status, String code, List<FieldError> fields) {
        this(status, code, fields, null);
    }

    public ExamFailure(
        int status,
        String code,
        List<FieldError> fields,
        MatrixPreview availability
    ) {
        super(code);
        this.status = status;
        this.code = code;
        this.fields = List.copyOf(fields);
        this.availability = availability;
    }
}
