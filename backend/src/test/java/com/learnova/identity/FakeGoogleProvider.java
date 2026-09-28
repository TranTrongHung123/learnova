package com.learnova.identity;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import tools.jackson.databind.ObjectMapper;

/** Provider chỉ nằm trong test classpath; không có route bypass trong production. */
public final class FakeGoogleProvider implements AutoCloseable {
    private final HttpServer server;
    private final RSAKey key;
    private final RSAKey otherKey;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, Grant> grants = new ConcurrentHashMap<>();
    private record Grant(String nonce, String challenge, String redirect, String email, String subject, String mode) {}

    public FakeGoogleProvider(int port) {
        try {
            key = new RSAKeyGenerator(2048).keyID("test-google").generate();
            otherKey = new RSAKeyGenerator(2048).keyID("other").generate();
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
            server.createContext("/authorize", this::authorize);
            server.createContext("/token", this::token);
            server.createContext("/jwks", exchange -> send(exchange, 200, "application/json", new JWKSet(key.toPublicJWK()).toString()));
            server.start();
        } catch (Exception ex) { throw new IllegalStateException("Cannot start test provider", ex); }
    }
    public String baseUrl() { return "http://localhost:" + server.getAddress().getPort(); }

    String issue(String authorizationUrl, String email, String subject, String mode) {
        var params = params(URI.create(authorizationUrl).getRawQuery());
        String code = UUID.randomUUID().toString();
        grants.put(code, new Grant(params.get("nonce"), params.get("code_challenge"), params.get("redirect_uri"), email, subject, mode));
        return code;
    }

    private void authorize(HttpExchange exchange) throws IOException {
        var params = params(exchange.getRequestURI().getRawQuery());
        if (!params.containsKey("email")) {
            var html = new StringBuilder("<!doctype html><html lang=\"vi\"><meta charset=\"UTF-8\"><title>Test Google</title><h1>Google provider dành cho test</h1><form method=\"get\" action=\"/authorize\">");
            params.forEach((name, value) -> html.append("<input type=\"hidden\" name=\"").append(escape(name)).append("\" value=\"").append(escape(value)).append("\">"));
            html.append("<label>Email Google <input name=\"email\" type=\"email\" required></label><button>Tiếp tục test</button><button name=\"cancel\" value=\"1\" formnovalidate>Hủy Google</button></form></html>");
            send(exchange, 200, "text/html; charset=UTF-8", html.toString());
            return;
        }
        String callback = params.get("redirect_uri");
        String result;
        if (params.containsKey("cancel")) result = "error=access_denied";
        else result = "code=" + issue(baseUrl() + exchange.getRequestURI(), params.get("email"), params.get("email"), "valid");
        exchange.getResponseHeaders().set("Location", callback + "?" + result + "&state=" + encode(params.get("state")));
        exchange.sendResponseHeaders(302, -1);
        exchange.close();
    }

    private void token(HttpExchange exchange) throws IOException {
        var params = params(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        var grant = grants.remove(params.get("code"));
        try {
            String verifier = params.getOrDefault("code_verifier", "");
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            if (grant == null || !challenge.equals(grant.challenge()) || !grant.redirect().equals(params.get("redirect_uri"))
                    || !"test-client".equals(params.get("client_id")) || !"test-secret".equals(params.get("client_secret"))) {
                send(exchange, 400, "application/json", "{\"error\":\"invalid_grant\"}");
                return;
            }
            var now = Instant.now();
            var claims = new JWTClaimsSet.Builder().issuer(grant.mode().equals("issuer") ? "https://wrong.example" : "https://accounts.google.com")
                    .audience(grant.mode().equals("audience") ? "wrong-client" : "test-client").subject(grant.subject())
                    .issueTime(Date.from(now.minusSeconds(120)))
                    .expirationTime(Date.from(now.plusSeconds(grant.mode().equals("expired") ? -90 : 300)))
                    .claim("nonce", grant.mode().equals("nonce") ? "wrong-nonce" : grant.nonce())
                    .claim("email", grant.email()).claim("email_verified", !grant.mode().equals("unverified"))
                    .claim("name", "Google Test User").build();
            var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
            jwt.sign(new RSASSASigner(grant.mode().equals("signature") ? otherKey : key));
            send(exchange, 200, "application/json", mapper.writeValueAsString(Map.of("access_token", "test-provider-token",
                    "token_type", "Bearer", "expires_in", 300, "id_token", jwt.serialize(), "scope", "openid email profile")));
        } catch (Exception ex) { send(exchange, 500, "application/json", "{\"error\":\"test_provider_failure\"}"); }
    }
    static Map<String, String> params(String raw) {
        var result = new LinkedHashMap<String, String>();
        if (raw != null) for (String pair : raw.split("&")) {
            var parts = pair.split("=", 2);
            result.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8), parts.length == 2 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "");
        }
        return result;
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String escape(String value) { return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;"); }
    private static void send(HttpExchange exchange, int status, String contentType, String text) throws IOException {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
    @Override public void close() { server.stop(0); }
}
