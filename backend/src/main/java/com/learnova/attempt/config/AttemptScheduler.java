package com.learnova.attempt.config;

import com.learnova.attempt.repository.AttemptRepository;
import com.learnova.attempt.service.AttemptFinalization;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
public class AttemptScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(AttemptScheduler.class);
    private final AttemptRepository attempts;
    private final AttemptFinalization finalization;
    private final Clock clock;

    public AttemptScheduler(
        AttemptRepository attempts,
        AttemptFinalization finalization,
        Clock clock
    ) {
        this.attempts = attempts;
        this.finalization = finalization;
        this.clock = clock;
    }

    @Scheduled(
        fixedDelayString = "${learnova.attempt.finalization-delay-ms:10000}",
        initialDelayString = "${learnova.attempt.finalization-delay-ms:10000}"
    )
    public void run() {
        var cutoff = clock.instant();
        AttemptRepository.Due cursor = null;
        while (true) {
            var batch = attempts.due(cutoff, cursor);
            if (batch.isEmpty()) return;
            for (var candidate : batch) {
                try {
                    finalization.expire(candidate.id());
                } catch (RuntimeException ex) {
                    // Cô lập lỗi từng bài; không log exception có thể chứa answer hoặc SQL parameter.
                    LOG.warn(
                        "Attempt finalization deferred for {} ({})",
                        candidate.id(),
                        ex.getClass().getSimpleName()
                    );
                }
            }
            cursor = batch.getLast();
        }
    }
}
