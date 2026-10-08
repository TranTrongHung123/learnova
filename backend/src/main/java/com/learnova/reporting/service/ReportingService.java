package com.learnova.reporting.service;

import com.learnova.reporting.dto.ReportingDtos.Analytics;
import com.learnova.reporting.repository.ReportingQueries;
import com.learnova.session.enums.AccessType;
import com.learnova.session.service.SessionService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.UUID;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class ReportingService {

    private final ReportingQueries queries;
    private final SessionService sessions;
    private final Clock clock;

    public ReportingService(ReportingQueries queries, SessionService sessions, Clock clock) {
        this.queries = queries;
        this.sessions = sessions;
        this.clock = clock;
    }

    public Analytics analytics(UUID actor, UUID id) {
        var s = sessions.detail(actor, id);
        return new Analytics(
            id,
            s.examVersionId(),
            s.title(),
            s.totalScore(),
            s.accessType().name(),
            clock.instant(),
            "BEST_SCORE_PER_PARTICIPANT",
            "ALL_GRADED_ATTEMPTS",
            queries.overview(id, s.accessType() == AccessType.PUBLIC),
            queries.distribution(id),
            queries.questions(id)
        );
    }

    public byte[] export(UUID actor, UUID id) {
        sessions.detail(actor, id);
        try (var workbook = new SXSSFWorkbook(100); var output = new ByteArrayOutputStream()) {
            workbook.setCompressTempFiles(true);
            var headerStyle = workbook.createCellStyle();
            var font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);
            String[] headers = {
                "Participant",
                "Email",
                "Attempt Number",
                "Best Score",
                "Raw Score",
                "Correct",
                "Incorrect",
                "Unanswered",
                "Started At (UTC)",
                "Submitted At (UTC)",
                "Duration (seconds)",
                "Pass/Fail",
                "Status",
            };
            Sheet[] sheet = { null };
            int[] rowNumber = { 1 };
            Runnable newSheet = () -> {
                sheet[0] = workbook.createSheet("Results " + (workbook.getNumberOfSheets() + 1));
                var row = sheet[0].createRow(0);
                for (int i = 0; i < headers.length; i++) {
                    var cell = row.createCell(i);
                    cell.setCellValue(headers[i]);
                    cell.setCellStyle(headerStyle);
                    sheet[0].setColumnWidth(i, (i < 2 ? 32 : 24) * 256);
                }
                sheet[0].createFreezePane(0, 1);
                rowNumber[0] = 1;
            };
            newSheet.run();
            queries.exportRows(id, r -> {
                if (rowNumber[0] >= 1_048_576) newSheet.run();
                var row = sheet[0].createRow(rowNumber[0]++);
                text(row, 0, r.getString("display_name"));
                text(row, 1, r.getString("email"));
                number(row, 2, r.getObject("attempt_number", Integer.class));
                number(row, 3, r.getBigDecimal("best_score"));
                number(row, 4, r.getBigDecimal("raw_score"));
                number(row, 5, r.getObject("correct_count", Long.class));
                number(row, 6, r.getObject("incorrect_count", Long.class));
                number(row, 7, r.getObject("unanswered_count", Long.class));
                text(row, 8, r.getTimestamp("started_at").toInstant().toString());
                var submitted = r.getTimestamp("submitted_at");
                text(row, 9, submitted == null ? null : submitted.toInstant().toString());
                number(row, 10, r.getObject("duration", Long.class));
                text(
                    row,
                    11,
                    r.getObject("passed") == null ? null : r.getBoolean("passed") ? "PASS" : "FAIL"
                );
                text(row, 12, r.getString("status"));
            });
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not generate session workbook", e);
        }
    }

    // Ghi kiểu STRING rõ ràng để dữ liệu người dùng không được diễn giải thành công thức.
    private static void text(Row row, int index, String value) {
        if (value != null) row.createCell(index, CellType.STRING).setCellValue(value);
    }

    private static void number(Row row, int index, Number value) {
        if (value != null) row.createCell(index, CellType.NUMERIC).setCellValue(
            value.doubleValue()
        );
    }
}
