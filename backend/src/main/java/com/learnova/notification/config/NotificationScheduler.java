package com.learnova.notification.config;

import com.learnova.notification.service.NotificationDeliveryService;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
public class NotificationScheduler {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(
        NotificationScheduler.class
    );
    private final NotificationDeliveryService service;

    public NotificationScheduler(NotificationDeliveryService service) {
        this.service = service;
    }

    @Scheduled(
        fixedDelayString = "${learnova.notification.delay-ms:30000}",
        initialDelayString = "${learnova.notification.delay-ms:30000}"
    )
    public void run() {
        try {
            service.reconcile();
        } catch (org.springframework.dao.DataAccessException ex) {
            LOG.warn("Notification delivery deferred; retry on next cycle");
        }
    }
}
