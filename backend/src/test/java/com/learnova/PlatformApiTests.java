package com.learnova;

import java.util.List;
import java.util.stream.Stream;

import com.learnova.health.HealthController;
import com.learnova.shared.api.ApiErrorController;
import com.learnova.shared.api.ApiExceptionHandler;
import com.learnova.shared.api.ApiProblems;
import com.learnova.shared.api.PageQuery;
import com.learnova.shared.api.PageResponse;
import com.learnova.shared.config.SecurityConfiguration;
import com.learnova.shared.config.WebConfiguration;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {HealthController.class, ApiErrorController.class, PlatformApiTests.TestController.class})
@Import({ApiProblems.class, ApiExceptionHandler.class, SecurityConfiguration.class,
        WebConfiguration.class, PlatformApiTests.TestEndpointsSecurity.class, PlatformApiTests.TestController.class})
class PlatformApiTests {
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder;
    @Autowired
    MockMvc mvc;

    @Test
    void publicHealthMatchesContract() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"status\":\"UP\"}"))
                .andExpect(jsonPath("$.components").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/actuator", "/actuator/health", "/actuator/env", "/api/v1/private", "/login", "/error"})
    void anonymousAccessIsDeniedWithoutLoginRedirect(String path) throws Exception {
        mvc.perform(get(path))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(header().doesNotExist("Location"))
                .andExpect(header().doesNotExist("WWW-Authenticate"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void actuatorIsDeniedEvenToAuthenticatedAdminInF01() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void csrfErrorUsesProblemContract() throws Exception {
        mvc.perform(post("/api/v1/health").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void beanValidationDoesNotExposeRejectedValues() throws Exception {
        mvc.perform(post("/test/body").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"count\":-782331}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(2))
                .andExpect(content().string(not(containsString("-782331"))))
                .andExpect(content().string(not(containsString("rejectedValue"))));
    }

    @Test
    void malformedJsonIsSanitized() throws Exception {
        mvc.perform(post("/test/body").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{private-secret"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString("private-secret"))));
    }

    @Test
    void invalidQueryIsSanitized() throws Exception {
        mvc.perform(get("/test/number").param("value", "private-secret"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString("private-secret"))));
        mvc.perform(get("/test/number").param("value", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("value"));
    }

    @Test
    void unsupportedMethodAndMediaTypePreserveStatusAndHeaders() throws Exception {
        mvc.perform(post("/test/page").with(csrf()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", containsString("GET")))
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
        mvc.perform(post("/test/body").with(csrf()).contentType(MediaType.TEXT_PLAIN).content("text"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void missingResourcesAndUnexpectedErrorsAreSanitized() throws Exception {
        mvc.perform(get("/test/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        mvc.perform(get("/test/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(content().string(not(containsString("private-secret"))));
        mvc.perform(get("/test/failure"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Internal Server Error"))
                .andExpect(jsonPath("$.instance").value("/test/failure"))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(content().string(not(containsString("private-secret"))))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    void servletErrorDispatchUsesSameContract() throws Exception {
        mvc.perform(get("/error").with(request -> {
                    request.setDispatcherType(DispatcherType.ERROR);
                    return request;
                })
                        .requestAttr(RequestDispatcher.ERROR_STATUS_CODE, 500)
                        .requestAttr(RequestDispatcher.ERROR_REQUEST_URI, "/api/v1/failure")
                        .requestAttr(RequestDispatcher.ERROR_MESSAGE, "private-secret"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.instance").value("/api/v1/failure"))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("private-secret"))));
    }

    @Test
    void paginationDefaultsAndEmptyPageAreStable() throws Exception {
        mvc.perform(get("/test/page"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"content":[],"page":0,"size":20,"totalElements":0,"totalPages":0}
                        """));
        mvc.perform(get("/test/page").param("page", "7").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(7))
                .andExpect(jsonPath("$.size").value(100));
        mvc.perform(get("/test/page").param("size", "1"))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @MethodSource("invalidPagination")
    void rejectsInvalidPagination(String field, String value) throws Exception {
        mvc.perform(get("/test/page").param(field, value))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value(field));
    }

    static Stream<Arguments> invalidPagination() {
        return Stream.of(Arguments.of("page", "-1"), Arguments.of("page", "bad"),
                Arguments.of("page", "2147483648"), Arguments.of("page", ""),
                Arguments.of("size", "0"), Arguments.of("size", "101"),
                Arguments.of("size", "1.5"), Arguments.of("size", ""));
    }

    @Test
    void duplicatePaginationIsRejected() throws Exception {
        mvc.perform(get("/test/page").param("size", "10", "20"))
                .andExpect(status().isBadRequest());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestEndpointsSecurity {
        @Bean
        @Order(0)
        SecurityFilterChain testEndpoints(HttpSecurity http, ApiProblems problems) throws Exception {
            return http.securityMatcher("/test/**")
                    .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                    .exceptionHandling(errors -> errors.accessDeniedHandler((request, response, ex) ->
                            problems.write(request, response, HttpStatus.FORBIDDEN)))
                    .build();
        }
    }

    @RestController
    static class TestController {
        @GetMapping("/test/page")
        PageResponse<String> page(PageQuery query) {
            return PageResponse.from(new PageImpl<>(List.of(), query.toPageable(Sort.unsorted()), 0));
        }

        @PostMapping(value = "/test/body", consumes = MediaType.APPLICATION_JSON_VALUE)
        Payload body(@Valid @RequestBody Payload payload) {
            return payload;
        }

        @GetMapping("/test/number")
        int number(@RequestParam @Min(1) int value) {
            return value;
        }

        @GetMapping("/test/failure")
        void failure() {
            throw new IllegalStateException("private-secret");
        }

        @GetMapping("/test/conflict")
        void conflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "private-secret");
        }

        record Payload(@NotBlank String name, @Min(1) int count) {}
    }
}
