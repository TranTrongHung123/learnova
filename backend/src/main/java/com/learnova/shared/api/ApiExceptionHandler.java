package com.learnova.shared.api;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final ApiProblems problems;

    public ApiExceptionHandler(ApiProblems problems) {
        this.problems = problems;
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
        Exception ex,
        Object body,
        HttpHeaders headers,
        HttpStatusCode status,
        WebRequest request
    ) {
        var problem = problem(status, request);
        if (ex instanceof MethodArgumentNotValidException validation) {
            validation(
                problem,
                validation
                    .getBindingResult()
                    .getFieldErrors()
                    .stream()
                    .map(error -> new ApiProblems.FieldError(error.getField(), "Invalid value."))
                    .distinct()
                    .toList()
            );
        } else if (
            ex instanceof HandlerMethodValidationException validation &&
            !validation.isForReturnValue()
        ) {
            validation(
                problem,
                validation
                    .getParameterValidationResults()
                    .stream()
                    .map(result ->
                        new ApiProblems.FieldError(
                            result.getMethodParameter().getParameterName() == null
                                ? "request"
                                : result.getMethodParameter().getParameterName(),
                            "Invalid value."
                        )
                    )
                    .distinct()
                    .toList()
            );
        }
        return super.handleExceptionInternal(ex, problem, headers, status, request);
    }

    @ExceptionHandler(InvalidPaginationException.class)
    ResponseEntity<Object> pagination(InvalidPaginationException ex, WebRequest request) {
        var problem = problem(HttpStatus.BAD_REQUEST, request);
        validation(problem, List.of(new ApiProblems.FieldError(ex.field(), ex.getMessage())));
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<Object> unauthenticated(AuthenticationException ex, WebRequest request) {
        return ResponseEntity.status(401).body(problem(HttpStatus.UNAUTHORIZED, request));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Object> forbidden(AccessDeniedException ex, WebRequest request) {
        return ResponseEntity.status(403).body(problem(HttpStatus.FORBIDDEN, request));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> unexpected(Exception ex, WebRequest request) {
        // Không ghi exception message/payload vì có thể chứa secret hoặc câu trả lời.
        LOG.error("Unhandled API exception: {}", ex.getClass().getName());
        return ResponseEntity.internalServerError().body(
            problem(HttpStatus.INTERNAL_SERVER_ERROR, request)
        );
    }

    private ProblemDetail problem(HttpStatusCode status, WebRequest request) {
        return problems.create(status, ((ServletWebRequest) request).getRequest().getRequestURI());
    }

    private void validation(ProblemDetail problem, List<ApiProblems.FieldError> errors) {
        problem.setProperty("code", "VALIDATION_FAILED");
        problem.setProperty("fieldErrors", errors);
    }
}
