package com.learnova.shared.config;

import com.learnova.shared.api.ApiProblems;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ApiProblems problems, JwtDecoder decoder,
            @Value("${learnova.auth.allowed-origins:http://localhost:3000}") String origins,
            @Value("${learnova.auth.cookie-secure:true}") boolean secure) throws Exception {
        var cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::strip).toList());
        if (cors.getAllowedOrigins().stream().anyMatch(value -> value.contains("*")))
            throw new IllegalStateException("CORS origins must be explicit.");
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-XSRF-TOKEN"));
        cors.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/**", cors);
        var csrf = new CookieCsrfTokenRepository();
        csrf.setCookieCustomizer(cookie -> cookie.httpOnly(true).secure(secure).sameSite("Lax").path("/api/v1/auth"));
        var authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return http
                .cors(config -> config.configurationSource(source))
                .csrf(config -> config.csrfTokenRepository(csrf)
                        .withObjectPostProcessor(new ObjectPostProcessor<CsrfFilter>() {
                            @Override
                            public <O extends CsrfFilter> O postProcess(O filter) {
                                // Auth API vẫn yêu cầu CSRF khi có bearer, không dùng exemption mặc định của resource server.
                                // API nghiệp vụ chỉ nhận bearer; cookie auth vẫn luôn được bảo vệ CSRF.
                                filter.setRequireCsrfProtectionMatcher(request -> CsrfFilter.DEFAULT_CSRF_MATCHER.matches(request)
                                        && !(request.getRequestURI().substring(request.getContextPath().length()).equals("/api/v1/classrooms")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/classrooms/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).equals("/api/v1/questions")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/questions/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).equals("/api/v1/exams")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/exams/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/exam-versions/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).equals("/api/v1/exam-sessions")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/exam-sessions/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/attempts/")
                                        || request.getRequestURI().substring(request.getContextPath().length()).equals("/api/v1/question-imports")
                                        || request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/v1/question-imports/")));
                                return filter;
                            }
                        }))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/google", "/api/v1/auth/google/config",
                                "/api/v1/auth/google/flow").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/google/onboarding", "/api/v1/auth/google/link/verify",
                                "/api/v1/auth/google/link/confirm", "/api/v1/auth/google/cancel").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login",
                                "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/profile").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/auth/profile").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/change-password").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout-all").authenticated()
                        .requestMatchers("/api/v1/classrooms", "/api/v1/classrooms/**").authenticated()
                        .requestMatchers("/api/v1/questions", "/api/v1/questions/**").authenticated()
                        .requestMatchers("/api/v1/exams", "/api/v1/exams/**", "/api/v1/exam-versions/**").authenticated()
                        .requestMatchers("/api/v1/exam-sessions", "/api/v1/exam-sessions/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/attempts/{id}").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/attempts/{id}/submit").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/attempts/{id}/answers/{questionId}").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/participant/exam-sessions", "/api/v1/participant/exam-sessions/**").authenticated()
                        .requestMatchers("/api/v1/question-imports", "/api/v1/question-imports/**").authenticated()
                        .requestMatchers("/actuator", "/actuator/**").denyAll()
                        .anyRequest().denyAll())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .oauth2ResourceServer(resource -> resource.jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint((request, response, ex) -> problems.write(request, response, HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, ex) -> problems.write(request, response, HttpStatus.FORBIDDEN)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) ->
                                problems.write(request, response, HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, ex) -> {
                            if (ex instanceof CsrfException && request.getRequestURI().startsWith("/api/v1/auth/"))
                                problems.write(request, response, HttpStatus.FORBIDDEN, "CSRF_INVALID");
                            else problems.write(request, response, HttpStatus.FORBIDDEN);
                        }))
                .build();
    }

    @Bean
    WebSecurityCustomizer rejectedRequests(ApiProblems problems) {
        return web -> web.requestRejectedHandler((request, response, ex) ->
                problems.write(request, response, HttpStatus.BAD_REQUEST));
    }
}
