package com.learnova.question.controller;

import com.learnova.question.exception.QuestionFailure;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0) @RestControllerAdvice(assignableTypes = QuestionController.class)
class QuestionExceptionHandler {
    private final ApiProblems problems;
    QuestionExceptionHandler(ApiProblems problems) { this.problems = problems; }
    @ExceptionHandler(QuestionFailure.class)
    ResponseEntity<?> failure(QuestionFailure ex, HttpServletRequest request) {
        var problem = problems.create(HttpStatusCode.valueOf(ex.status), request.getRequestURI());
        problem.setProperty("code", ex.code); problem.setProperty("fieldErrors", ex.fields);
        return ResponseEntity.status(ex.status).body(problem);
    }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> authentication(AuthFailure ex, HttpServletRequest request) { return failure(new QuestionFailure(ex.status, ex.code), request); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException ex, HttpServletRequest request) { return failure(new QuestionFailure(503, "SERVICE_UNAVAILABLE"), request); }
}
