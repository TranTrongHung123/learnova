package com.learnova.session.config;

import com.learnova.session.service.SessionLifecycle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
public class SessionScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(SessionScheduler.class);
    private final SessionLifecycle lifecycle;

    public SessionScheduler(SessionLifecycle lifecycle) {
        this.lifecycle = lifecycle;
    }

    @Scheduled(
        fixedDelayString = "${learnova.session.lifecycle-delay-ms:10000}",
        initialDelayString = "${learnova.session.lifecycle-delay-ms:10000}"
    )
    public void run() {
        for (var id : lifecycle.due()) {
            try {
                lifecycle.advance(id);
            } catch (DataAccessException ex) {
                LOG.warn("Session lifecycle deferred for {}", id);
            }
        }
    }
}
