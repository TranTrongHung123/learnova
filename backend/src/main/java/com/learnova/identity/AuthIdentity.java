package com.learnova.identity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "auth_identities")
class AuthIdentity {
    @Id UUID id;
    @Column(nullable = false) UUID userId;
    @Column(nullable = false, length = 16) String provider;
    @Column(nullable = false, length = 254) String providerSubject;
    @Column(length = 512) String passwordHash;
    protected AuthIdentity() {}
    static AuthIdentity google(User user, String subject) {
        var identity = new AuthIdentity();
        identity.id = UUID.randomUUID();
        identity.userId = user.id;
        identity.provider = "GOOGLE";
        identity.providerSubject = subject;
        return identity;
    }
    AuthIdentity(User user, String hash) {
        id = UUID.randomUUID();
        userId = user.id;
        provider = "LOCAL";
        providerSubject = user.email;
        passwordHash = hash;
    }
}
