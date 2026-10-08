package com.learnova.notification.controller;

import com.learnova.identity.exception.AuthFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes = NotificationController.class)
class NotificationExceptionHandler {

    private final ApiProblems problems;

    NotificationExceptionHandler(ApiProblems problems) {
        this.problems = problems;
    }

    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> auth(AuthFailure ex, HttpServletRequest request) {
        var p = problems.create(HttpStatusCode.valueOf(ex.status), request.getRequestURI());
        p.setProperty("code", ex.code);
        return ResponseEntity.status(ex.status).body(p);
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException ex, HttpServletRequest request) {
        return ResponseEntity.status(503).body(
            problems.create(HttpStatus.SERVICE_UNAVAILABLE, request.getRequestURI())
        );
    }
}
