package com.learnova.shared.api;

public class InvalidPaginationException extends RuntimeException {

    private final String field;

    public InvalidPaginationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
