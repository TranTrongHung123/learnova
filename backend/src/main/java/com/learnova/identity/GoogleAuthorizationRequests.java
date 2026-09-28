package com.learnova.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.Set;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import tools.jackson.databind.ObjectMapper;

class GoogleAuthorizationRequests implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
    private final GoogleFlowStore flows;
    private final ObjectMapper mapper;
    GoogleAuthorizationRequests(GoogleFlowStore flows, ObjectMapper mapper) { this.flows = flows; this.mapper = mapper; }

    record Stored(String authorizationUri, String clientId, String redirectUri, Set<String> scopes, String state,
            Map<String, Object> additionalParameters, Map<String, Object> attributes) {
        @Override public String toString() { return "Stored[redacted]"; }
        OAuth2AuthorizationRequest request() {
            return OAuth2AuthorizationRequest.authorizationCode().authorizationUri(authorizationUri).clientId(clientId)
                    .redirectUri(redirectUri).scopes(scopes).state(state)
                    .additionalParameters(additionalParameters).attributes(attributes).build();
        }
    }

    @Override public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        String raw = flows.get("oauth", flows.browserToken(request));
        if (raw == null) return null;
        var stored = mapper.readValue(raw, Stored.class);
        return stored.state().equals(request.getParameter("state")) ? stored.request() : null;
    }

    @Override public void saveAuthorizationRequest(OAuth2AuthorizationRequest auth, HttpServletRequest request,
            HttpServletResponse response) {
        if (auth == null) { flows.cancel(request, response); return; }
        var stored = new Stored(auth.getAuthorizationUri(), auth.getClientId(), auth.getRedirectUri(), auth.getScopes(),
                auth.getState(), auth.getAdditionalParameters(), auth.getAttributes());
        flows.put("oauth", flows.replace(request, response), mapper.writeValueAsString(stored));
    }

    @Override public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
            HttpServletResponse response) {
        if (loadAuthorizationRequest(request) == null) return null;
        String raw = flows.take("oauth", flows.browserToken(request));
        return raw == null ? null : mapper.readValue(raw, Stored.class).request();
    }
}
