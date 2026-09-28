package com.learnova.identity.controller;

import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.security.RefreshSessions;
import com.learnova.identity.service.IdentityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    public static final String COOKIE = "learnova_refresh";
    private final IdentityService identity;
    private final RefreshSessions sessions;
    private final AccessTokens tokens;
    private final Clock clock;
    private final boolean secure;
    AuthController(IdentityService identity, RefreshSessions sessions, AccessTokens tokens, Clock clock,
            @Value("${learnova.auth.cookie-secure:true}") boolean secure) {
        this.identity = identity; this.sessions = sessions; this.tokens = tokens; this.clock = clock; this.secure = secure;
    }

    @GetMapping("/csrf")
    Map<String, String> csrf(HttpServletRequest request) {
        var token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthDtos.UserSummary register(@Valid @RequestBody AuthDtos.RegisterRequest request) { return identity.register(request); }

    @PostMapping("/login")
    AuthDtos.TokenResponse login(@Valid @RequestBody AuthDtos.LoginRequest request,
            @CookieValue(name = COOKIE, required = false) String previous, HttpServletResponse response) {
        var user = identity.authenticate(request);
        logoutSession(previous);
        return respond(user, sessions.create(user.id()), response);
    }

    @PostMapping("/refresh")
    AuthDtos.TokenResponse refresh(@CookieValue(name = COOKIE, required = false) String token, HttpServletResponse response) {
        try {
            var session = sessions.lookup(token);
            AuthDtos.UserSummary user;
            try { user = identity.activeUser(session.userId()); }
            catch (AuthFailure failure) { sessions.revoke(session); throw failure; }
            return respond(user, sessions.rotate(token, session), response);
        } catch (AuthFailure failure) {
            clearCookie(response);
            throw failure;
        }
    }

    @GetMapping("/me")
    AuthDtos.UserSummary me(@AuthenticationPrincipal Jwt jwt) { return identity.activeUser(userId(jwt)); }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@CookieValue(name = COOKIE, required = false) String token, HttpServletResponse response) {
        logoutSession(token);
        clearCookie(response);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logoutAll(@AuthenticationPrincipal Jwt jwt, HttpServletResponse response) {
        sessions.revokeAll(userId(jwt));
        clearCookie(response);
    }

    private void logoutSession(String token) {
        if (token == null) return;
        try { sessions.revoke(sessions.lookup(token)); }
        catch (AuthFailure ignored) { /* Logout lặp lại vẫn thành công khi token không còn hợp lệ. */ }
    }
    void googleSession(UUID userId, HttpServletRequest request, HttpServletResponse response) {
        identity.activeUser(userId);
        if (request.getCookies() != null)
            for (var cookie : request.getCookies())
                if (COOKIE.equals(cookie.getName())) logoutSession(cookie.getValue());
        var issued = sessions.create(userId);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(issued.token(),
                Duration.between(clock.instant(), issued.session().expiresAt())).toString());
    }
    private AuthDtos.TokenResponse respond(AuthDtos.UserSummary user, RefreshSessions.Issued issued,
            HttpServletResponse response) {
        var result = tokens.issue(user, issued.session().sessionId());
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(issued.token(),
                Duration.between(clock.instant(), issued.session().expiresAt())).toString());
        return result;
    }
    private UUID userId(Jwt jwt) {
        try { return UUID.fromString(jwt.getSubject()); }
        catch (IllegalArgumentException ex) { throw new AuthFailure(401, "AUTHENTICATION_REQUIRED"); }
    }
    private ResponseCookie cookie(String value, Duration age) {
        return ResponseCookie.from(COOKIE, value).httpOnly(true).secure(secure).sameSite("Lax")
                .path("/api/v1/auth").maxAge(age).build();
    }
    private void clearCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }
}
