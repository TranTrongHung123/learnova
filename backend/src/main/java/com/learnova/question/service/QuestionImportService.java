package com.learnova.question.service;

import com.learnova.audit.enums.AuditAction;
import com.learnova.audit.service.AuditService;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionImportDtos.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.question.repository.QuestionImportRepository;
import com.learnova.question.repository.QuestionImportRepository.Batch;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class QuestionImportService {

    private final QuestionImportRepository repository;
    private final QuestionWorkbook workbook;
    private final QuestionService questions;
    private final QuestionValidation validation;
    private final IdentityService identity;
    private final AuditService audit;
    private final Clock clock;

    public QuestionImportService(
        QuestionImportRepository repository,
        QuestionWorkbook workbook,
        QuestionService questions,
        QuestionValidation validation,
        IdentityService identity,
        AuditService audit,
        Clock clock
    ) {
        this.repository = repository;
        this.workbook = workbook;
        this.questions = questions;
        this.validation = validation;
        this.identity = identity;
        this.audit = audit;
        this.clock = clock;
    }

    public byte[] template(UUID actor) {
        authorize(actor);
        return workbook.template();
    }

    public Preview upload(UUID actor, MultipartFile file) {
        authorize(actor);
        var rows = workbook.parse(file);
        authorize(actor);
        UUID id = UUID.randomUUID();
        Instant now = clock.instant();
        repository.insert(id, actor, now, now.plus(Duration.ofHours(24)), rows);
        return preview(actor, id, RowFilter.ALL, 0, 20);
    }

    public Preview preview(UUID actor, UUID id, RowFilter filter, int page, int size) {
        authorize(actor);
        if (page < 0 || size < 1 || size > 100) throw new QuestionFailure(
            400,
            "INVALID_PAGINATION"
        );
        var batch = owned(actor, id, false);
        checkExpiry(batch);
        return view(batch, filter, page, size);
    }

    @Transactional
    public Preview confirm(UUID actor, UUID id, boolean validRowsOnly) {
        authorize(actor);
        var batch = owned(actor, id, true);
        if (batch.status().equals("CONFIRMED")) return view(batch, RowFilter.ALL, 0, 20);
        checkExpiry(batch);
        if (batch.valid() == 0) throw new QuestionFailure(409, "IMPORT_NO_VALID_ROWS");
        if (batch.valid() != batch.total() && !validRowsOnly) throw new QuestionFailure(
            409,
            "IMPORT_HAS_INVALID_ROWS"
        );
        for (var row : batch.rows())
            if (row.valid()) {
                validation.validateComplete(row.question());
                questions.create(actor, row.question());
            }
        repository.confirmed(id, clock.instant());
        audit.record(
            actor.toString(),
            AuditAction.QUESTIONS_IMPORTED,
            "QUESTION_IMPORT",
            id.toString(),
            Map.of(
                "importedRows",
                Integer.toString(batch.valid()),
                "skippedRows",
                Integer.toString(batch.total() - batch.valid())
            )
        );
        return view(owned(actor, id, false), RowFilter.ALL, 0, 20);
    }

    @Transactional
    public int cleanup() {
        return repository.cleanup(clock.instant());
    }

    private Batch owned(UUID actor, UUID id, boolean lock) {
        return repository
            .owned(id, actor, lock)
            .orElseThrow(() -> new QuestionFailure(404, "IMPORT_NOT_FOUND"));
    }

    private void authorize(UUID actor) {
        if (!identity.activeUser(actor).roles().contains("CREATOR")) throw new QuestionFailure(
            403,
            "FORBIDDEN"
        );
    }

    private void checkExpiry(Batch batch) {
        if (
            !batch.status().equals("CONFIRMED") && !clock.instant().isBefore(batch.expiresAt())
        ) throw new QuestionFailure(410, "IMPORT_EXPIRED");
    }

    private Preview view(Batch batch, RowFilter filter, int page, int size) {
        var filtered = batch
            .rows()
            .stream()
            .filter(row -> filter == RowFilter.ALL || row.valid() == (filter == RowFilter.VALID))
            .toList();
        boolean confirmed = batch.status().equals("CONFIRMED");
        return new Preview(
            batch.id(),
            batch.status(),
            batch.expiresAt(),
            batch.confirmedAt(),
            batch.total(),
            batch.valid(),
            batch.total() - batch.valid(),
            confirmed ? batch.valid() : 0,
            confirmed ? batch.total() - batch.valid() : 0,
            filtered
                .stream()
                .skip((long) page * size)
                .limit(size)
                .toList(),
            page,
            size,
            filtered.size(),
            (filtered.size() + size - 1) / size
        );
    }
}
