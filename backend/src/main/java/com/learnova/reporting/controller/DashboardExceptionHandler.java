package com.learnova.reporting.controller;

import com.learnova.identity.exception.AuthFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes=DashboardController.class)
class DashboardExceptionHandler {
    private final ApiProblems problems;
    DashboardExceptionHandler(ApiProblems problems) { this.problems=problems; }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> failure(AuthFailure ex,HttpServletRequest request) {
        var problem=problems.create(HttpStatusCode.valueOf(ex.status),request.getRequestURI());
        problem.setProperty("code",ex.code);
        return ResponseEntity.status(ex.status).body(problem);
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> unavailable(DataAccessException ex,HttpServletRequest request) {
        return failure(new AuthFailure(503,"SERVICE_UNAVAILABLE"),request);
    }
}
