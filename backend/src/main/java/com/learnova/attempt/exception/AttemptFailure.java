package com.learnova.attempt.exception;

public class AttemptFailure extends RuntimeException {
    public final int status;
    public final String code;
    public AttemptFailure(int status, String code) { super(code); this.status=status; this.code=code; }
}
