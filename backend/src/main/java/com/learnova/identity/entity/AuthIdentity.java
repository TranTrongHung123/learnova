package com.learnova.identity.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "auth_identities")
public class AuthIdentity {
    @Id UUID id;
    @Column(nullable = false) UUID userId;
    @Column(nullable = false, length = 16) String provider;
    @Column(nullable = false, length = 254) String providerSubject;
    @Column(length = 512) String passwordHash;
    protected AuthIdentity() {}
    public static AuthIdentity google(User user, String subject) {
        var identity = new AuthIdentity();
        identity.id = UUID.randomUUID();
        identity.userId = user.id;
        identity.provider = "GOOGLE";
        identity.providerSubject = subject;
        return identity;
    }
    public AuthIdentity(User user, String hash) {
        id = UUID.randomUUID();
        userId = user.id;
        provider = "LOCAL";
        providerSubject = user.email;
        passwordHash = hash;
    }

    public UUID getUserId() { return userId; }

    public String getPasswordHash() { return passwordHash; }
}
