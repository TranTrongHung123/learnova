package com.learnova.attempt.controller;

import com.learnova.attempt.exception.AttemptFailure;
import com.learnova.exam.exception.ExamFailure;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.session.exception.SessionFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes = AttemptController.class)
class AttemptExceptionHandler {

    private final ApiProblems problems;

    AttemptExceptionHandler(ApiProblems problems) {
        this.problems = problems;
    }

    @ExceptionHandler(AttemptFailure.class)
    ResponseEntity<?> failure(AttemptFailure ex, HttpServletRequest r) {
        var p = problems.create(HttpStatusCode.valueOf(ex.status), r.getRequestURI());
        p.setProperty("code", ex.code);
        return ResponseEntity.status(ex.status).body(p);
    }

    @ExceptionHandler(SessionFailure.class)
    ResponseEntity<?> session(SessionFailure ex, HttpServletRequest r) {
        return failure(new AttemptFailure(ex.status, ex.code), r);
    }

    @ExceptionHandler(ExamFailure.class)
    ResponseEntity<?> exam(ExamFailure ex, HttpServletRequest r) {
        return failure(new AttemptFailure(ex.status, ex.code), r);
    }

    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> auth(AuthFailure ex, HttpServletRequest r) {
        return failure(new AttemptFailure(ex.status, ex.code), r);
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException ex, HttpServletRequest r) {
        return failure(new AttemptFailure(503, "SERVICE_UNAVAILABLE"), r);
    }
}
