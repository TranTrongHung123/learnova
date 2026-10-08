package com.learnova.identity.config;

import com.learnova.identity.controller.GoogleController;
import com.learnova.identity.exception.AuthFailure;
import com.learnova.identity.security.google.GoogleAuthorizationRequests;
import com.learnova.identity.security.google.GoogleFlowStore;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.endpoint.RestClientAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.web.client.RestClient;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "learnova.auth.google.enabled", havingValue = "true")
class GoogleOAuthConfiguration {

    @Bean
    ClientRegistrationRepository googleRegistration(
        @Value("${learnova.auth.google.client-id}") String clientId,
        @Value("${learnova.auth.google.client-secret}") String secret,
        @Value("${learnova.auth.google.redirect-uri}") String redirect,
        @Value(
            "${learnova.auth.google.authorization-uri:https://accounts.google.com/o/oauth2/v2/auth}"
        ) String authorization,
        @Value(
            "${learnova.auth.google.token-uri:https://oauth2.googleapis.com/token}"
        ) String token,
        @Value(
            "${learnova.auth.google.jwk-set-uri:https://www.googleapis.com/oauth2/v3/certs}"
        ) String jwks,
        @Value("${learnova.auth.google.issuer-uri:https://accounts.google.com}") String issuer
    ) {
        if (clientId.isBlank() || secret.isBlank()) throw new IllegalArgumentException(
            "Google credentials are required"
        );
        return new InMemoryClientRegistrationRepository(
            ClientRegistration.withRegistrationId("google")
                .clientId(clientId)
                .clientSecret(secret)
                .clientName("Google")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(redirect)
                .scope("openid", "email", "profile")
                .authorizationUri(authorization)
                .tokenUri(token)
                .jwkSetUri(jwks)
                .issuerUri(issuer)
                .build()
        );
    }

    @Bean
    @Order(1)
    SecurityFilterChain googleSecurity(
        HttpSecurity http,
        ClientRegistrationRepository registrations,
        GoogleFlowStore flows,
        ObjectMapper mapper,
        GoogleController controller
    ) throws Exception {
        var resolver = new DefaultOAuth2AuthorizationRequestResolver(
            registrations,
            "/unused-google-entry"
        );
        resolver.setAuthorizationRequestCustomizer(
            OAuth2AuthorizationRequestCustomizers.withPkce()
        );
        var requests = new GoogleAuthorizationRequests(flows, mapper);
        var transport = new SimpleClientHttpRequestFactory();
        transport.setConnectTimeout(Duration.ofSeconds(5));
        transport.setReadTimeout(Duration.ofSeconds(5));
        var exchange = new RestClientAuthorizationCodeTokenResponseClient();
        exchange.setRestClient(
            RestClient.builder()
                .requestFactory(transport)
                .configureMessageConverters(converters ->
                    converters
                        .disableDefaults()
                        .addCustomConverter(new FormHttpMessageConverter())
                        .addCustomConverter(new OAuth2AccessTokenResponseHttpMessageConverter())
                )
                .defaultStatusHandler(new OAuth2ErrorResponseErrorHandler())
                .build()
        );
        return http
            .securityMatcher("/api/v1/auth/google", "/api/v1/auth/google/callback")
            .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .securityContext(context ->
                context.securityContextRepository(new NullSecurityContextRepository())
            )
            .requestCache(AbstractHttpConfigurer::disable)
            .addFilterBefore(
                new OncePerRequestFilter() {
                    @Override
                    protected void doFilterInternal(
                        HttpServletRequest request,
                        HttpServletResponse response,
                        FilterChain chain
                    ) throws ServletException, IOException {
                        try {
                            chain.doFilter(request, response);
                        } catch (DataAccessException ex) {
                            controller.failure(response, "SERVICE_UNAVAILABLE");
                        }
                    }
                },
                OAuth2AuthorizationRequestRedirectFilter.class
            )
            .oauth2Login(oauth ->
                oauth
                    .withObjectPostProcessor(
                        new org.springframework.security.config.ObjectPostProcessor<OAuth2AuthorizationRequestRedirectFilter>() {
                            @Override
                            public <O extends OAuth2AuthorizationRequestRedirectFilter> O postProcess(
                                O filter
                            ) {
                                filter.setAuthenticationFailureHandler(
                                    (request, response, exception) ->
                                        controller.failure(response, "SERVICE_UNAVAILABLE")
                                );
                                return filter;
                            }
                        }
                    )
                    .tokenEndpoint(endpoint -> endpoint.accessTokenResponseClient(exchange))
                    .authorizationEndpoint(endpoint ->
                        endpoint
                            .authorizationRequestResolver(
                                new OAuth2AuthorizationRequestResolver() {
                                    @Override
                                    public OAuth2AuthorizationRequest resolve(
                                        HttpServletRequest request
                                    ) {
                                        return request
                                            .getRequestURI()
                                            .equals("/api/v1/auth/google") &&
                                            request.getMethod().equals("GET")
                                            ? resolver.resolve(request, "google")
                                            : null;
                                    }

                                    @Override
                                    public OAuth2AuthorizationRequest resolve(
                                        HttpServletRequest request,
                                        String id
                                    ) {
                                        return resolve(request);
                                    }
                                }
                            )
                            .authorizationRequestRepository(requests)
                    )
                    .redirectionEndpoint(endpoint ->
                        endpoint.baseUri("/api/v1/auth/google/callback")
                    )
                    .authorizedClientRepository(
                        new OAuth2AuthorizedClientRepository() {
                            @Override
                            public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(
                                String id,
                                Authentication principal,
                                HttpServletRequest request
                            ) {
                                return null;
                            }

                            @Override
                            public void saveAuthorizedClient(
                                OAuth2AuthorizedClient client,
                                Authentication principal,
                                HttpServletRequest request,
                                HttpServletResponse response
                            ) {}

                            @Override
                            public void removeAuthorizedClient(
                                String id,
                                Authentication principal,
                                HttpServletRequest request,
                                HttpServletResponse response
                            ) {}
                        }
                    )
                    .successHandler((request, response, authentication) -> {
                        try {
                            var user = (OidcUser) authentication.getPrincipal();
                            if (
                                !Boolean.TRUE.equals(user.getEmailVerified())
                            ) throw new AuthFailure(401, "GOOGLE_EMAIL_UNVERIFIED");
                            controller.success(
                                user.getSubject(),
                                user.getEmail(),
                                user.getFullName(),
                                request,
                                response
                            );
                        } catch (AuthFailure failure) {
                            controller.failure(response, failure.code);
                        } catch (DataAccessException failure) {
                            controller.failure(response, "SERVICE_UNAVAILABLE");
                        }
                    })
                    .failureHandler((request, response, exception) ->
                        controller.failure(response, "GOOGLE_AUTH_FAILED")
                    )
            )
            .build();
    }
}
