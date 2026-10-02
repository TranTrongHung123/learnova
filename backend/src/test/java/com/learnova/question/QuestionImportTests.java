package com.learnova.question;

import com.learnova.TestcontainersConfiguration;
import com.learnova.identity.dto.AuthDtos;
import com.learnova.identity.security.AccessTokens;
import com.learnova.identity.service.IdentityService;
import com.learnova.question.dto.QuestionImportDtos.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.question.service.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;
import javax.sql.DataSource;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
class QuestionImportTests {
    @Autowired QuestionImportService service;
    @Autowired QuestionWorkbook workbook;
    @Autowired IdentityService identity;
    @Autowired AccessTokens tokens;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired DataSource dataSource;

    @Test void fourTypesPreviewThenDraftsWithExactNumbersAndAudit() throws Exception {
        var owner = user("CREATOR");
        var rows = List.of(
            Map.of("type", "SINGLE_CHOICE", "content", "Một", "option1", "A", "option2", "B", "correctOptions", "1"),
            Map.of("type", "MULTIPLE_CHOICE", "content", "Nhiều", "option1", "A", "option2", "B", "correctOptions", "1;2"),
            Map.of("type", "TRUE_FALSE", "content", "Đúng sai", "correctBoolean", "FALSE"),
            Map.of("type", "NUMERIC_ANSWER", "content", "Số", "correctValue", "12345678901234567890.1234567891", "tolerance", "0.0000000001"));
        var preview = service.upload(owner.id(), file(rows));
        assertThat(preview.validRows()).isEqualTo(4);
        assertThat(count(owner)).isZero();
        assertThat(service.preview(owner.id(), preview.importId(), RowFilter.VALID, 1, 2).content()).extracting(Row::rowNumber).containsExactly(4, 5);
        var result = service.confirm(owner.id(), preview.importId(), false);
        assertThat(result.importedRows()).isEqualTo(4);
        assertThat(jdbc.queryForList("select status from questions where owner_id=?", String.class, owner.id())).containsOnly("DRAFT");
        assertThat(jdbc.queryForObject("select correct_value::text from questions where owner_id=? and type='NUMERIC_ANSWER'", String.class, owner.id())).isEqualTo("12345678901234567890.1234567891");
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=? and action='QUESTIONS_IMPORTED'", Long.class, owner.id().toString())).isEqualTo(1);
        assertThat(service.confirm(owner.id(), preview.importId(), true).importedRows()).isEqualTo(4);
        assertThat(count(owner)).isEqualTo(4);
    }
    @Test void invalidRowsRequireExplicitOptInAndNoValidRowsCannotConfirm() throws Exception {
        var owner = user("CREATOR");
        var preview = service.upload(owner.id(), file(List.of(valid(), Map.of("type", "TRUE_FALSE", "content", "Thiếu đáp án"))));
        assertThat(preview.invalidRows()).isEqualTo(1);
        assertThat(preview.content().get(1).errors()).isNotEmpty();
        fails("IMPORT_HAS_INVALID_ROWS", () -> service.confirm(owner.id(), preview.importId(), false));
        assertThat(count(owner)).isZero();
        assertThat(service.confirm(owner.id(), preview.importId(), true).skippedRows()).isEqualTo(1);
        var invalid = service.upload(owner.id(), file(List.of(Map.of("type", "BAD"))));
        fails("IMPORT_NO_VALID_ROWS", () -> service.confirm(owner.id(), invalid.importId(), true));
    }
    @Test void ownershipCurrentRoleAndTamperingAreRejectedByHttp() throws Exception {
        var owner = user("CREATOR"); var other = user("CREATOR"); var participant = user("PARTICIPANT");
        var preview = service.upload(owner.id(), file(List.of(valid())));
        String path = "/api/v1/question-imports/" + preview.importId();
        mvc.perform(get(path).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(post(path + "/confirm").with(as(other)).contentType("application/json").content("{}")) .andExpect(status().isNotFound());
        for (String body : List.of("{\"rows\":[]}", "{\"ownerId\":\"spoof\"}", "{\"validRowsOnly\":false,\"question\":{}}"))
            mvc.perform(post(path + "/confirm").with(as(owner)).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        mvc.perform(get(path).with(as(participant))).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/question-imports").file(file(List.of(valid()))).with(as(participant))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/question-imports/template")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/question-imports/template").with(as(owner))).andExpect(status().isOk()).andExpect(header().string("Content-Disposition", "attachment; filename=learnova-questions.xlsx"));
        mvc.perform(multipart("/api/v1/question-imports").file(file(List.of(valid()))).with(as(owner))).andExpect(status().isCreated()).andExpect(jsonPath("$.validRows").value(1));
        jdbc.update("update user_roles set role='ADMIN' where user_id=?", owner.id());
        mvc.perform(post(path + "/confirm").with(as(owner)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
        assertThat(count(owner)).isZero();
    }
    @Test void concurrentConfirmCreatesOneBatch() throws Exception {
        var owner = user("CREATOR"); var preview = service.upload(owner.id(), file(List.of(valid(), valid())));
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var tasks = new ArrayList<Future<Preview>>();
            for (int i = 0; i < 3; i++) tasks.add(executor.submit(() -> { gate.await(); return service.confirm(owner.id(), preview.importId(), false); }));
            gate.countDown();
            for (var task : tasks) assertThat(task.get(20, TimeUnit.SECONDS).importedRows()).isEqualTo(2);
        }
        assertThat(count(owner)).isEqualTo(2);
    }
    @Test void rollbackRestoresReadyAndRemovesQuestionsAndAudit() throws Exception {
        var owner = user("CREATOR"); var preview = service.upload(owner.id(), file(List.of(valid(), valid())));
        new TransactionTemplate(manager).executeWithoutResult(tx -> { service.confirm(owner.id(), preview.importId(), false); tx.setRollbackOnly(); });
        assertThat(count(owner)).isZero();
        assertThat(service.preview(owner.id(), preview.importId(), RowFilter.ALL, 0, 20).status()).isEqualTo("READY");
        assertThat(jdbc.queryForObject("select count(*) from audit_records where actor_user_id=?", Long.class, owner.id().toString())).isZero();
        assertThat(service.confirm(owner.id(), preview.importId(), false).importedRows()).isEqualTo(2);
    }
    @Test void expiryCleanupAndConfirmedReplayPreserveHistory() throws Exception {
        var owner = user("CREATOR"); var pending = service.upload(owner.id(), file(List.of(valid())));
        var done = service.upload(owner.id(), file(List.of(valid()))); service.confirm(owner.id(), done.importId(), false);
        expire(pending.importId()); expire(done.importId());
        fails("IMPORT_EXPIRED", () -> service.confirm(owner.id(), pending.importId(), true));
        fails("IMPORT_EXPIRED", () -> service.preview(owner.id(), pending.importId(), RowFilter.ALL, 0, 20));
        service.cleanup();
        assertThat(jdbc.queryForObject("select payload is null from question_imports where id=?", Boolean.class, pending.importId())).isTrue();
        assertThat(service.confirm(owner.id(), done.importId(), false).importedRows()).isEqualTo(1);
        assertThat(count(owner)).isEqualTo(1);
    }
    @Test void cleanupSkipsLockedConfirmBatch() throws Exception {
        var owner = user("CREATOR"); var preview = service.upload(owner.id(), file(List.of(valid())));
        expire(preview.importId());
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            jdbc.queryForObject("select id from question_imports where id=? for update", UUID.class, preview.importId());
            try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
                try { executor.submit(() -> service.cleanup()).get(10, TimeUnit.SECONDS); }
                catch (Exception e) { throw new AssertionError(e); }
            }
            assertThat(jdbc.queryForObject("select payload is not null from question_imports where id=?", Boolean.class, preview.importId())).isTrue();
        });
        service.cleanup();
        assertThat(jdbc.queryForObject("select payload is null from question_imports where id=?", Boolean.class, preview.importId())).isTrue();
    }
    @Test void parserRejectsBadFilesHeadersAndLimits() throws Exception {
        fails("IMPORT_INVALID_FILE", () -> workbook.parse(new MockMultipartFile("file", "fake.xlsx", null, "hello".getBytes())));
        fails("IMPORT_FILE_TOO_LARGE", () -> workbook.parse(new MockMultipartFile("file", "big.xlsx", null, new byte[QuestionWorkbook.MAX_BYTES + 1])));
        fails("IMPORT_EMPTY_FILE", () -> workbook.parse(new MockMultipartFile("file", "empty.xlsx", null, workbook.template())));
        fails("IMPORT_TOO_MANY_ROWS", () -> workbook.parse(file(Collections.nCopies(1001, valid()))));
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(workbook.template())); var out = new ByteArrayOutputStream()) {
            book.getSheet("Questions").getRow(0).getCell(0).setCellValue("wrong"); book.write(out);
            fails("IMPORT_INVALID_TEMPLATE", () -> workbook.parse(new MockMultipartFile("file", "wrong.xlsx", null, out.toByteArray())));
        }
    }
    @Test void parserKeepsRowNumbersAndReportsFormulaAndAnswerErrors() throws Exception {
        var rows = List.of(valid(), Map.of("type", "NUMERIC_ANSWER", "content", "Số", "correctValue", "0.12345678901"),
                Map.of("type", "SINGLE_CHOICE", "content", "Q", "option1", "A", "option2", "B", "correctOptions", "1;1"),
                Map.of("type", "TRUE_FALSE", "content", "Q", "correctBoolean", "maybe"));
        try (var book = new XSSFWorkbook(file(rows).getInputStream()); var out = new ByteArrayOutputStream()) {
            var sheet = book.getSheet("Questions");
            sheet.createRow(8).createCell(0).setBlank();
            var row = sheet.createRow(10); row.createCell(0).setCellValue("TRUE_FALSE"); row.createCell(1).setCellFormula("1+1");
            book.write(out);
            var parsed = workbook.parse(new MockMultipartFile("file", "rows.xlsx", null, out.toByteArray()));
            assertThat(parsed).extracting(Row::rowNumber).containsExactly(2, 3, 4, 5, 11);
            assertThat(parsed.stream().filter(Row::valid).count()).isEqualTo(1);
            assertThat(parsed.getLast().errors()).anyMatch(e -> e.field().equals("content") && e.message().contains("công thức"));
        }
    }
    @Test void migrationFromV6PreservesExistingQuestions() {
        String schema = "import_" + UUID.randomUUID().toString().replace("-", "");
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).target("6").load().migrate();
        UUID owner = UUID.randomUUID(), question = UUID.randomUUID();
        jdbc.update("insert into " + schema + ".users(id,email,display_name,status,created_at,onboarding_completed) values (?,?,'Old','ACTIVE',now(),true)", owner, owner + "@example.com");
        jdbc.update("insert into " + schema + ".questions(id,owner_id,type,status,content,created_at,updated_at) values (?,?,'TRUE_FALSE','DRAFT','Old',now(),now())", question, owner);
        org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();
        assertThat(jdbc.queryForObject("select content from " + schema + ".questions where id=?", String.class, question)).isEqualTo("Old");
    }
    @Test void emptyConfirmBodyDefaultsToAllRowsAndRejectsInvalidRows() throws Exception {
        var owner = user("CREATOR");
        var validBatch = service.upload(owner.id(), file(List.of(valid())));
        mvc.perform(post("/api/v1/question-imports/" + validBatch.importId() + "/confirm").with(as(owner)).contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedRows").value(1));
        var mixed = service.upload(owner.id(), file(List.of(valid(), Map.of("type", "TRUE_FALSE"))));
        mvc.perform(post("/api/v1/question-imports/" + mixed.importId() + "/confirm").with(as(owner)).contentType("application/json").content("{}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IMPORT_HAS_INVALID_ROWS"));
        assertThat(count(owner)).isEqualTo(1);
    }
    @Test void parserBoundsExpandedZipAndEntryCountAndRejectsActiveContent() throws Exception {
        var manyEntries = new LinkedHashMap<String, byte[]>();
        for (int i = 0; i < 101; i++) manyEntries.put("part" + i, new byte[0]);
        fails("IMPORT_RESOURCE_LIMIT", () -> workbook.parse(archive(manyEntries)));
        fails("IMPORT_RESOURCE_LIMIT", () -> workbook.parse(archive(Map.of("large.xml", new byte[20 * 1024 * 1024 + 1]))));
        fails("IMPORT_RESOURCE_LIMIT", () -> workbook.parse(archive(Map.of("a.xml", new byte[18 * 1024 * 1024],
                "b.xml", new byte[18 * 1024 * 1024], "c.xml", new byte[18 * 1024 * 1024]))));
        fails("IMPORT_INVALID_FILE", () -> workbook.parse(archive(Map.of("xl/vbaProject.bin", new byte[0]))));
        fails("IMPORT_INVALID_FILE", () -> workbook.parse(archive(Map.of("xl/externalLinks/externalLink1.xml", new byte[0]))));
    }
    @Test void oversizedCellsAreErrorsAndNeverImportedAsTruncatedValues() throws Exception {
        var values = new HashMap<>(valid()); values.put("content", "x".repeat(10001));
        var rows = workbook.parse(file(List.of(values)));
        assertThat(rows.getFirst().valid()).isFalse();
        assertThat(rows.getFirst().question()).isNull();
        assertThat(rows.getFirst().cells().get("content")).hasSize(10000);
        assertThat(rows.getFirst().errors()).anyMatch(error -> error.field().equals("content"));
    }
    private MockMultipartFile archive(Map<String, byte[]> entries) throws IOException {
        var output = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(output)) {
            for (var entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey())); zip.write(entry.getValue()); zip.closeEntry();
            }
        }
        return new MockMultipartFile("file", "archive.xlsx", null, output.toByteArray());
    }
    private MockMultipartFile file(List<Map<String, String>> rows) throws IOException {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(workbook.template())); var out = new ByteArrayOutputStream()) {
            int index = 1;
            for (var values : rows) {
                var row = book.getSheet("Questions").createRow(index++);
                values.forEach((key, value) -> row.createCell(QuestionWorkbook.HEADERS.indexOf(key)).setCellValue(value));
            }
            book.write(out); return new MockMultipartFile("file", "questions.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
        }
    }
    private Map<String, String> valid() { return Map.of("type", "TRUE_FALSE", "content", "Hợp lệ", "correctBoolean", "TRUE"); }
    private long count(AuthDtos.UserSummary user) { return jdbc.queryForObject("select count(*) from questions where owner_id=?", Long.class, user.id()); }
    private void expire(UUID id) { jdbc.update("update question_imports set created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=?", id); }
    private void fails(String code, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) { assertThatThrownBy(action).isInstanceOfSatisfying(QuestionFailure.class, e -> assertThat(e.code).isEqualTo(code)); }
    private AuthDtos.UserSummary user(String role) { return identity.register(new AuthDtos.RegisterRequest(UUID.randomUUID() + "@example.com", "Test password 123", "Import", List.of(role))); }
    private RequestPostProcessor as(AuthDtos.UserSummary user) { String token = tokens.issue(user, UUID.randomUUID().toString()).accessToken(); return request -> { request.addHeader("Authorization", "Bearer " + token); return request; }; }
}
