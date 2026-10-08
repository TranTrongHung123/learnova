package com.learnova.shared.api;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiErrorController implements ErrorController {

    private final ApiProblems problems;

    public ApiErrorController(ApiProblems problems) {
        this.problems = problems;
    }

    @RequestMapping("/error")
    ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
        Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = code instanceof Integer value && value >= 400 && value <= 599 ? value : 500;
        Object originalPath = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        String path = originalPath instanceof String value ? value : request.getRequestURI();
        return ResponseEntity.status(status).body(
            problems.create(HttpStatusCode.valueOf(status), path)
        );
    }
}
