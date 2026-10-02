package com.learnova.question.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.learnova.shared.api.ApiProblems.FieldError;
import java.time.Instant;
import java.util.*;

public final class QuestionImportDtos {
    private QuestionImportDtos() {}
    public enum RowFilter { ALL, VALID, INVALID }
    public record Confirm(Boolean validRowsOnly) {
        @JsonAnySetter public void unknown(String name, Object value) { throw new IllegalArgumentException("Unknown import field"); }
    }
    public record Row(int rowNumber, Map<String, String> cells, QuestionDtos.WriteQuestion question, List<FieldError> errors) {
        public boolean valid() { return errors.isEmpty(); }
    }
    public record Preview(UUID importId, String status, Instant expiresAt, Instant confirmedAt,
            int totalRows, int validRows, int invalidRows, int importedRows, int skippedRows,
            List<Row> content, int page, int size, long totalElements, int totalPages) {}
}
