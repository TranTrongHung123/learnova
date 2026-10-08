package com.learnova.session.exception;

import com.learnova.shared.api.ApiProblems.FieldError;
import java.util.List;

public class SessionFailure extends RuntimeException {

    public final int status;
    public final String code;
    public final List<FieldError> fields;

    public SessionFailure(int status, String code) {
        this(status, code, List.of());
    }

    public SessionFailure(int status, String code, List<FieldError> fields) {
        super(code);
        this.status = status;
        this.code = code;
        this.fields = List.copyOf(fields);
    }
}
