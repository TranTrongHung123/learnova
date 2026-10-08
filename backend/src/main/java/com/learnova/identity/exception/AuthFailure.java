package com.learnova.identity.exception;

public class AuthFailure extends RuntimeException {

    public final int status;
    public final String code;
    public final String field;

    public AuthFailure(int status, String code) {
        this(status, code, null);
    }

    public AuthFailure(int status, String code, String field) {
        super(code);
        this.status = status;
        this.code = code;
        this.field = field;
    }
}
