package com.learnova.session.controller;

import com.learnova.session.exception.SessionFailure;
import com.learnova.exam.exception.ExamFailure;
import com.learnova.classroom.exception.ClassroomFailure;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Order(0) @RestControllerAdvice(assignableTypes={SessionController.class, DiscoveryController.class, com.learnova.attempt.controller.ResultController.class, com.learnova.monitoring.controller.MonitoringController.class, com.learnova.reporting.controller.ReportingController.class})
class SessionExceptionHandler {
    private final ApiProblems problems;
    SessionExceptionHandler(ApiProblems problems) { this.problems=problems; }
    @ExceptionHandler(SessionFailure.class)
    ResponseEntity<?> failure(SessionFailure ex,HttpServletRequest request) {
        var p=problems.create(HttpStatusCode.valueOf(ex.status),request.getRequestURI());
        p.setProperty("code",ex.code); p.setProperty("fieldErrors",ex.fields); return ResponseEntity.status(ex.status).body(p);
    }
    @ExceptionHandler(ExamFailure.class)
    ResponseEntity<?> exam(ExamFailure ex,HttpServletRequest r) { return failure(new SessionFailure(ex.status,ex.code,ex.fields),r); }
    @ExceptionHandler(ClassroomFailure.class)
    ResponseEntity<?> classroom(ClassroomFailure ex,HttpServletRequest r) { return failure(new SessionFailure(ex.status,ex.code),r); }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> auth(AuthFailure ex,HttpServletRequest r) { return failure(new SessionFailure(ex.status,ex.code),r); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException ex,HttpServletRequest r) { return failure(new SessionFailure(503,"SERVICE_UNAVAILABLE"),r); }
}
