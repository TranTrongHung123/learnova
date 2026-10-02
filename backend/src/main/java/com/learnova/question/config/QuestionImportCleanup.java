package com.learnova.question.config;

import com.learnova.question.service.QuestionImportService;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration @EnableScheduling
public class QuestionImportCleanup {
    private final QuestionImportService service;
    public QuestionImportCleanup(QuestionImportService service) { this.service = service; }
    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void cleanup() { service.cleanup(); }
}
