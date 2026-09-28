package com.learnova.identity.controller;

import com.learnova.identity.security.google.GoogleFlowStore;
import com.learnova.identity.service.GoogleAccounts;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/google")
public class GoogleController {
    private final GoogleAccounts accounts;
    private final GoogleFlowStore flows;
    private final AuthController auth;
    private final boolean enabled;
    private final String frontend;

    GoogleController(GoogleAccounts accounts, GoogleFlowStore flows, AuthController auth,
            @Value("${learnova.auth.google.enabled:false}") boolean enabled,
            @Value("${learnova.auth.google.frontend-url:http://localhost:3000}") String frontend) {
        this.accounts = accounts; this.flows = flows; this.auth = auth; this.enabled = enabled;
        var uri = java.net.URI.create(frontend);
        if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
                || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getUserInfo() != null
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
            throw new IllegalArgumentException("Google frontend URL must be a fixed HTTP origin");
        this.frontend = frontend.replaceAll("/+$", "");
    }

    @GetMapping("/config") Map<String, Boolean> config() { return Map.of("enabled", enabled); }

    // Đường này chỉ được gọi khi OAuth filter chưa bật.
    @GetMapping void unavailable(HttpServletResponse response) throws IOException {
        response.sendRedirect(frontend + "/auth/google/callback?error=GOOGLE_UNAVAILABLE");
    }

    record FlowResponse(String state, String email) {}
    @GetMapping("/flow") FlowResponse flow(HttpServletRequest request) {
        var value = flows.read(request);
        return new FlowResponse(value.state(), value.email());
    }
    record RolesRequest(List<String> roles) {}
    record PasswordRequest(@NotNull @Size(max = 256) String password) {
        @Override public String toString() { return "PasswordRequest[redacted]"; }
    }

    @PostMapping("/onboarding") @ResponseStatus(HttpStatus.NO_CONTENT)
    void onboard(@RequestBody RolesRequest roles, HttpServletRequest request, HttpServletResponse response) {
        GoogleAccounts.validateRoles(roles.roles());
        var pending = flows.consume(request, "ONBOARDING");
        finish(accounts.onboard(pending, roles.roles()), request, response);
    }

    @PostMapping("/link/verify") @ResponseStatus(HttpStatus.NO_CONTENT)
    void verify(@Valid @RequestBody PasswordRequest password, HttpServletRequest request) {
        flows.beginPasswordAttempt(request);
        var pending = flows.read(request);
        accounts.verify(pending, password.password());
        flows.verified(request, pending);
    }

    @PostMapping("/link/confirm") @ResponseStatus(HttpStatus.NO_CONTENT)
    void confirm(HttpServletRequest request, HttpServletResponse response) {
        finish(accounts.link(flows.consume(request, "LINK_CONFIRMATION")), request, response);
    }

    @PostMapping("/cancel") @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancel(HttpServletRequest request, HttpServletResponse response) { flows.cancel(request, response); }

    void finish(UUID userId, HttpServletRequest request, HttpServletResponse response) {
        flows.cancel(request, response);
        auth.googleSession(userId, request, response);
    }

    public void success(String subject, String email, String name, HttpServletRequest request,
            HttpServletResponse response) throws IOException {
        var pending = accounts.recognize(subject, email, name);
        if (pending.state().equals("AUTHENTICATED")) finish(pending.userId(), request, response);
        else flows.pending(request, response, pending);
        response.sendRedirect(frontend + "/auth/google/callback");
    }

    public void failure(HttpServletResponse response, String code) throws IOException {
        response.sendRedirect(frontend + "/auth/google/callback?error=" + code);
    }
}
