package com.learnova.identity;

import java.time.Clock;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
class AccessTokens {
    private final JwtEncoder encoder;
    private final Clock clock;
    private final String issuer;
    AccessTokens(JwtEncoder encoder, Clock clock, @Value("${learnova.auth.issuer}") String issuer) {
        this.encoder = encoder;
        this.clock = clock;
        this.issuer = issuer;
    }
    AuthDtos.TokenResponse issue(AuthDtos.UserSummary user, String sessionId) {
        var now = clock.instant();
        var expiry = now.plusSeconds(900);
        var claims = JwtClaimsSet.builder().issuer(issuer).subject(user.id().toString())
                .audience(List.of("learnova-api")).issuedAt(now).expiresAt(expiry)
                .claim("roles", user.roles()).claim("sid", sessionId).build();
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new AuthDtos.TokenResponse(token, "Bearer", 900, expiry, user);
    }
}
