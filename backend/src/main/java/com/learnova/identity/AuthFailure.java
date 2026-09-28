package com.learnova.identity;

class AuthFailure extends RuntimeException {
    final int status;
    final String code;
    final String field;
    AuthFailure(int status, String code) { this(status, code, null); }
    AuthFailure(int status, String code, String field) {
        super(code);
        this.status = status;
        this.code = code;
        this.field = field;
    }
}
