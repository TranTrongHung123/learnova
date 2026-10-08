package com.learnova.classroom.controller;

import com.learnova.classroom.exception.ClassroomFailure;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes = ClassroomController.class)
class ClassroomExceptionHandler {

    private final ApiProblems problems;

    ClassroomExceptionHandler(ApiProblems problems) {
        this.problems = problems;
    }

    @ExceptionHandler(ClassroomFailure.class)
    ResponseEntity<?> failure(ClassroomFailure ex, HttpServletRequest request) {
        return response(ex.status, ex.code, request);
    }

    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> authentication(AuthFailure ex, HttpServletRequest request) {
        return response(ex.status, ex.code, request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(DataIntegrityViolationException ex, HttpServletRequest request) {
        return response(409, "CLASSROOM_CONFLICT", request);
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> unavailable(DataAccessException ex, HttpServletRequest request) {
        return response(503, "SERVICE_UNAVAILABLE", request);
    }

    private ResponseEntity<?> response(int status, String code, HttpServletRequest request) {
        var problem = problems.create(HttpStatusCode.valueOf(status), request.getRequestURI());
        problem.setProperty("code", code);
        return ResponseEntity.status(status).body(problem);
    }
}
