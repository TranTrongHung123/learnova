package com.learnova.classroom.exception;

public class ClassroomFailure extends RuntimeException {

    public final int status;
    public final String code;

    public ClassroomFailure(int status, String code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
