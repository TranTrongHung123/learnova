package com.learnova.identity.service;

import com.learnova.identity.repository.UserRepository;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Contract chỉ đọc cho nghiệp vụ thêm Participant; không lộ entity identity. */
@Service
@Transactional(readOnly = true)
public class ParticipantDirectory {

    private final UserRepository users;

    public ParticipantDirectory(UserRepository users) {
        this.users = users;
    }

    public record Participant(UUID userId, String email, String displayName) {}

    public Optional<Participant> byEmail(String email) {
        return users
            .findByEmail(email.strip().toLowerCase(Locale.ROOT))
            .filter(
                u ->
                    u.getStatus().equals("ACTIVE") &&
                    u.isOnboardingCompleted() &&
                    u.getRoles().contains("PARTICIPANT")
            )
            .map(u -> new Participant(u.getId(), u.getEmail(), u.getDisplayName()));
    }

    public Optional<Participant> byId(UUID id) {
        return users
            .findById(id)
            .filter(
                u ->
                    u.getStatus().equals("ACTIVE") &&
                    u.isOnboardingCompleted() &&
                    u.getRoles().contains("PARTICIPANT")
            )
            .map(u -> new Participant(u.getId(), u.getEmail(), u.getDisplayName()));
    }
}
