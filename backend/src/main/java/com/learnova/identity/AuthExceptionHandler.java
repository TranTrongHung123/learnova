package com.learnova.identity;

import com.learnova.shared.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes = AuthController.class)
class AuthExceptionHandler {
    private final ApiProblems problems;
    AuthExceptionHandler(ApiProblems problems) { this.problems = problems; }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> failure(AuthFailure failure, HttpServletRequest request) {
        var problem = problems.create(HttpStatusCode.valueOf(failure.status), request.getRequestURI());
        problem.setProperty("code", failure.code);
        if (failure.field != null) problem.setProperty("fieldErrors", List.of(new ApiProblems.FieldError(failure.field, "Invalid value.")));
        return ResponseEntity.status(failure.status).body(problem);
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(DataIntegrityViolationException failure, HttpServletRequest request) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof org.hibernate.exception.ConstraintViolationException violation
                    && "users_email_key".equals(violation.getConstraintName()))
                return failure(new AuthFailure(409, "EMAIL_ALREADY_EXISTS"), request);
        }
        return failure(new AuthFailure(500, "INTERNAL_ERROR"), request);
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> unavailable(DataAccessException failure, HttpServletRequest request) {
        return failure(new AuthFailure(503, "SERVICE_UNAVAILABLE"), request);
    }
}
