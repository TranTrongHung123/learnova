package com.learnova.identity.controller;

import com.learnova.identity.dto.ProfileDtos;
import com.learnova.identity.service.ProfileService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class ProfileController {

    private final ProfileService profiles;

    ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/profile")
    ProfileDtos.Profile get(@AuthenticationPrincipal Jwt jwt) {
        return profiles.get(UUID.fromString(jwt.getSubject()));
    }

    @PutMapping("/profile")
    ProfileDtos.Profile update(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ProfileDtos.UpdateProfile input
    ) {
        return profiles.update(UUID.fromString(jwt.getSubject()), input);
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void password(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ProfileDtos.ChangePassword input
    ) {
        profiles.changePassword(
            UUID.fromString(jwt.getSubject()),
            jwt.getClaimAsString("sid"),
            input
        );
    }
}
