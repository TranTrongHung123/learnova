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
    AuthIdentity(User user, String hash) {
        id = UUID.randomUUID();
        userId = user.id;
        provider = "LOCAL";
        providerSubject = user.email;
        passwordHash = hash;
    }
}
