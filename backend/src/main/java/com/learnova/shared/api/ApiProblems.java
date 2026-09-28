package com.learnova.shared.api;

import java.io.IOException;
import java.net.URI;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ApiProblems {
    private final ObjectMapper mapper;

    public ApiProblems(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ProblemDetail create(HttpStatusCode status, String path) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail(status.value()));
        problem.setType(URI.create("about:blank"));
        var knownStatus = HttpStatus.resolve(status.value());
        problem.setTitle(knownStatus == null
                ? (status.is5xxServerError() ? "Internal Server Error" : "Request Rejected")
                : knownStatus.getReasonPhrase());
        problem.setInstance(instance(path));
        problem.setProperty("code", code(status.value()));
        problem.setProperty("fieldErrors", List.of());
        return problem;
    }

    private static URI instance(String path) {
        try {
            return URI.create(path);
        } catch (IllegalArgumentException ex) {
            // Firewall có thể từ chối URI sai cú pháp; renderer lỗi vẫn phải hoạt động.
            return URI.create("/");
        }
    }

    public void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), create(status, request.getRequestURI()));
    }

    public void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        var problem = create(status, request.getRequestURI());
        problem.setProperty("code", code);
        mapper.writeValue(response.getOutputStream(), problem);
    }

    private static String code(int status) {
        return switch (status) {
            case 400 -> "INVALID_REQUEST";
            case 401 -> "AUTHENTICATION_REQUIRED";
            case 403 -> "ACCESS_DENIED";
            case 404 -> "RESOURCE_NOT_FOUND";
            case 405 -> "METHOD_NOT_ALLOWED";
            case 406 -> "NOT_ACCEPTABLE";
            case 409 -> "CONFLICT";
            case 413 -> "PAYLOAD_TOO_LARGE";
            case 415 -> "UNSUPPORTED_MEDIA_TYPE";
            case 503 -> "SERVICE_UNAVAILABLE";
            default -> status >= 500 ? "INTERNAL_ERROR" : "REQUEST_REJECTED";
        };
    }

    private static String detail(int status) {
        return switch (status) {
            case 400 -> "The request is invalid.";
            case 401 -> "Authentication is required.";
            case 403 -> "Access is denied.";
            case 404 -> "The requested resource was not found.";
            case 405 -> "The HTTP method is not supported.";
            case 406 -> "The requested response format is not supported.";
            case 409 -> "The request conflicts with the current resource state.";
            case 413 -> "The request is too large.";
            case 415 -> "The request media type is not supported.";
            case 503 -> "The service is temporarily unavailable.";
            default -> status >= 500 ? "An unexpected error occurred." : "The request was rejected.";
        };
    }

    public record FieldError(String field, String message) {}
}
