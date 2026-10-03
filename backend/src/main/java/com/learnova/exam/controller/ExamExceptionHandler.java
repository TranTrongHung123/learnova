package com.learnova.exam.controller;

import com.learnova.exam.exception.ExamFailure;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0) @RestControllerAdvice(assignableTypes = ExamController.class)
class ExamExceptionHandler {
    private final ApiProblems problems;
    ExamExceptionHandler(ApiProblems problems) { this.problems = problems; }
    @ExceptionHandler(ExamFailure.class)
    ResponseEntity<?> failure(ExamFailure ex, HttpServletRequest request) {
        var problem = problems.create(HttpStatusCode.valueOf(ex.status), request.getRequestURI());
        problem.setProperty("code", ex.code); problem.setProperty("fieldErrors", ex.fields);
        if (ex.availability != null) problem.setProperty("availability", ex.availability);
        return ResponseEntity.status(ex.status).body(problem);
    }
    @ExceptionHandler(QuestionFailure.class)
    ResponseEntity<?> question(QuestionFailure ex, HttpServletRequest request) { return failure(new ExamFailure(ex.status, ex.code, ex.fields), request); }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> authentication(AuthFailure ex, HttpServletRequest request) { return failure(new ExamFailure(ex.status, ex.code), request); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException ex, HttpServletRequest request) { return failure(new ExamFailure(503, "SERVICE_UNAVAILABLE"), request); }
}
