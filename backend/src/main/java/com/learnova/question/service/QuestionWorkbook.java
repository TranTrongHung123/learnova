package com.learnova.question.service;

import com.learnova.question.dto.QuestionDtos.*;
import com.learnova.question.dto.QuestionImportDtos.Row;
import com.learnova.question.enums.*;
import com.learnova.question.exception.QuestionFailure;
import com.learnova.shared.api.ApiProblems.FieldError;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class QuestionWorkbook {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static final int MAX_ROWS = 1000;
    public static final List<String> HEADERS;
    static {
        var headers = new ArrayList<>(List.of("type", "content", "explanation", "difficulty", "category", "tags"));
        for (int i = 1; i <= 20; i++) headers.add("option" + i);
        headers.addAll(List.of("correctOptions", "correctBoolean", "correctValue", "tolerance"));
        HEADERS = List.copyOf(headers);
        ZipSecureFile.setMaxEntrySize(20L * 1024 * 1024);
        ZipSecureFile.setMaxFileCount(100);
    }
    private final QuestionValidation validation;
    public QuestionWorkbook(QuestionValidation validation) { this.validation = validation; }

    public List<Row> parse(MultipartFile file) {
        if (file.getSize() > MAX_BYTES) throw failure(413, "IMPORT_FILE_TOO_LARGE");
        if (file.isEmpty() || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx"))
            throw failure(400, "IMPORT_INVALID_FILE");
        try (var input = file.getInputStream()) {
            byte[] bytes = input.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw failure(413, "IMPORT_FILE_TOO_LARGE");
            checkArchive(bytes);
            try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                if (workbook.isMacroEnabled() || !workbook.getExternalLinksTable().isEmpty()) throw failure(400, "IMPORT_INVALID_FILE");
                var sheet = workbook.getSheet("Questions");
                if (sheet == null || workbook.getNumberOfSheets() > 2) throw failure(400, "IMPORT_INVALID_TEMPLATE");
                for (var candidate : workbook) if (!Set.of("Questions", "Instructions").contains(candidate.getSheetName())) throw failure(400, "IMPORT_INVALID_TEMPLATE");
                checkHeader(sheet.getRow(0));
                var rows = new ArrayList<Row>();
                int inspected = 0;
                for (var source : sheet) {
                    if (++inspected > 10001) throw failure(400, "IMPORT_RESOURCE_LIMIT");
                    if (source.getRowNum() == 0 || blank(source)) continue;
                    if (rows.size() >= MAX_ROWS) throw failure(400, "IMPORT_TOO_MANY_ROWS");
                    rows.add(parseRow(source));
                }
                if (rows.isEmpty()) throw failure(400, "IMPORT_EMPTY_FILE");
                return List.copyOf(rows);
            }
        } catch (QuestionFailure ex) { throw ex; }
        catch (IOException | RuntimeException ex) { throw failure(400, "IMPORT_INVALID_FILE"); }
    }
    private void checkArchive(byte[] bytes) throws IOException {
        long total = 0; int entries = 0;
        var names = new HashSet<String>();
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (++entries > 100 || !names.add(name)) throw failure(400, "IMPORT_RESOURCE_LIMIT");
                if (name.toLowerCase(Locale.ROOT).contains("vbaproject") || name.startsWith("xl/externalLinks/")) throw failure(400, "IMPORT_INVALID_FILE");
                long size = 0; int read;
                while ((read = zip.read(buffer)) != -1) {
                    size += read; total += read;
                    if (size > 20L * 1024 * 1024 || total > 50L * 1024 * 1024) throw failure(400, "IMPORT_RESOURCE_LIMIT");
                }
            }
        }
        if (!names.contains("[Content_Types].xml") || !names.contains("xl/workbook.xml")) throw failure(400, "IMPORT_INVALID_FILE");
    }
    private void checkHeader(org.apache.poi.ss.usermodel.Row row) {
        if (row == null || row.getLastCellNum() != HEADERS.size()) throw failure(400, "IMPORT_INVALID_TEMPLATE");
        for (int i = 0; i < HEADERS.size(); i++) {
            Cell cell = row.getCell(i);
            if (cell == null || cell.getCellType() != CellType.STRING || !HEADERS.get(i).equals(cell.getStringCellValue().strip()))
                throw failure(400, "IMPORT_INVALID_TEMPLATE");
        }
    }
    private boolean blank(org.apache.poi.ss.usermodel.Row row) {
        for (var cell : row) if (cell.getCellType() != CellType.BLANK && (cell.getCellType() != CellType.STRING || !cell.getStringCellValue().isBlank())) return false;
        return true;
    }
    private Row parseRow(org.apache.poi.ss.usermodel.Row source) {
        var errors = new ArrayList<FieldError>();
        var cells = new LinkedHashMap<String, String>();
        for (var cell : source) if (cell.getColumnIndex() >= HEADERS.size() && cell.getCellType() != CellType.BLANK)
            errors.add(new FieldError("row", "Có dữ liệu ngoài các cột của template."));
        for (int i = 0; i < HEADERS.size(); i++) cells.put(HEADERS.get(i), text(source.getCell(i), HEADERS.get(i), errors));
        QuestionType type = enumValue(QuestionType.class, cells.get("type"), "type", errors);
        Difficulty difficulty = enumValue(Difficulty.class, cells.get("difficulty"), "difficulty", errors);
        var correct = new HashSet<Integer>();
        String answer = cells.get("correctOptions");
        if (answer != null) for (String token : answer.split(";", -1)) {
            try {
                if (!token.strip().matches("[0-9]{1,2}")) throw new NumberFormatException();
                int number = Integer.parseInt(token.strip());
                if (number < 1 || number > 20 || !correct.add(number) || cells.get("option" + number) == null) throw new NumberFormatException();
            } catch (NumberFormatException ex) { errors.add(new FieldError("correctOptions", "Dùng chỉ số lựa chọn có nội dung, từ 1–20, không trùng, phân cách bằng ;.")); }
        }
        boolean choice = type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE;
        if (!choice && answer != null) errors.add(new FieldError("correctOptions", "Chỉ dùng cho câu hỏi lựa chọn."));
        int last = 0;
        for (int i = 1; i <= 20; i++) if (cells.get("option" + i) != null) last = i;
        var options = new ArrayList<Option>();
        for (int i = 1; i <= last; i++) options.add(new Option(cells.get("option" + i), correct.contains(i)));
        Boolean bool = null;
        String rawBoolean = cells.get("correctBoolean");
        if (rawBoolean != null) {
            if (rawBoolean.equalsIgnoreCase("true") || rawBoolean.equalsIgnoreCase("false")) bool = Boolean.valueOf(rawBoolean);
            else errors.add(new FieldError("correctBoolean", "Nhập TRUE hoặc FALSE."));
        }
        String rawTags = cells.get("tags");
        List<String> tags = rawTags == null ? List.of() : Arrays.stream(rawTags.split(";", -1)).map(String::strip).toList();
        var question = new WriteQuestion(type, QuestionStatus.DRAFT, cells.get("content"), cells.get("explanation"), difficulty,
                cells.get("category"), tags, options, bool, cells.get("correctValue"), cells.get("tolerance"), null);
        try { validation.validateComplete(question); } catch (QuestionFailure ex) { errors.addAll(ex.fields); }
        return new Row(source.getRowNum() + 1, cells, errors.isEmpty() ? question : null, List.copyOf(errors));
    }
    private <E extends Enum<E>> E enumValue(Class<E> type, String raw, String field, List<FieldError> errors) {
        if (raw == null) return null;
        try { return Enum.valueOf(type, raw); }
        catch (IllegalArgumentException ex) { errors.add(new FieldError(field, "Giá trị không hợp lệ: " + raw.substring(0, Math.min(40, raw.length())))); return null; }
    }
    private String text(Cell cell, String field, List<FieldError> errors) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return null;
        String value;
        switch (cell.getCellType()) {
            case STRING -> value = cell.getStringCellValue();
            case BOOLEAN -> value = Boolean.toString(cell.getBooleanCellValue());
            case NUMERIC -> {
                String raw = ((XSSFCell) cell).getRawValue();
                // Đọc số XML trực tiếp, không đi qua double làm mất precision lần nữa.
                if (raw.length() > 64 || DateUtil.isCellDateFormatted(cell)) { errors.add(new FieldError(field, "Dùng Text hoặc số thập phân, không dùng ngày.")); return null; }
                BigDecimal decimal = new BigDecimal(raw);
                if (Math.abs((long) decimal.scale()) > 100) { errors.add(new FieldError(field, "Số vượt giới hạn.")); return null; }
                value = decimal.toPlainString();
            }
            default -> { errors.add(new FieldError(field, "Không hỗ trợ công thức hoặc ô lỗi Excel; hãy nhập giá trị trực tiếp.")); return null; }
        }
        if (value.length() > 10000) {
            errors.add(new FieldError(field, "Ô vượt 10.000 ký tự; preview chỉ hiển thị phần đầu."));
            value = value.substring(0, 10000);
        }
        return value.isBlank() ? null : value.strip();
    }
    public byte[] template() {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Questions");
            var header = sheet.createRow(0);
            var textStyle = workbook.createCellStyle(); textStyle.setDataFormat(workbook.createDataFormat().getFormat("@"));
            for (int i = 0; i < HEADERS.size(); i++) {
                header.createCell(i).setCellValue(HEADERS.get(i));
                sheet.setDefaultColumnStyle(i, textStyle); sheet.setColumnWidth(i, 24 * 256);
            }
            sheet.createFreezePane(2, 1);
            var instructions = workbook.createSheet("Instructions");
            String[] help = {
                "Learnova — chỉ sheet Questions được import; mỗi dòng là một câu hỏi.",
                "Tối đa 5 MiB, 1.000 câu hỏi. Preview có hiệu lực 24 giờ; confirm tạo DRAFT đủ nội dung và đáp án.",
                "Giữ nguyên header. Nội dung thuần văn bản; không dùng công thức, macro hoặc liên kết ngoài.",
                "type: SINGLE_CHOICE / MULTIPLE_CHOICE / TRUE_FALSE / NUMERIC_ANSWER.",
                "difficulty tùy chọn: EASY / MEDIUM / HARD. tags phân cách bằng ;. category và explanation tùy chọn.",
                "option1–option20: điền liên tục; correctOptions là chỉ số phân cách bằng ; (ví dụ 1;3).",
                "correctBoolean: TRUE hoặc FALSE. correctValue/tolerance dùng dấu chấm; tolerance mặc định 0.",
                "Giữ định dạng Text cho đáp án số để Excel không làm tròn: tối đa 20 chữ số nguyên, 10 chữ số thập phân.",
                "Ví dụ SINGLE_CHOICE: content=2+2?; option1=4; option2=5; correctOptions=1.",
                "Ví dụ MULTIPLE_CHOICE: content=Chọn số chẵn; option1=2; option2=3; option3=4; correctOptions=1;3.",
                "Ví dụ TRUE_FALSE: content=2 là số chẵn; correctBoolean=TRUE.",
                "Ví dụ NUMERIC_ANSWER: content=Giá trị pi (2 chữ số); correctValue=3.14; tolerance=0.01.",
                "Chỉ điền cột đáp án áp dụng cho loại câu hỏi. Sửa file rồi upload lại nếu có lỗi; không sửa preview.",
                "Mỗi upload mới là lô độc lập; không tự loại câu trùng nội dung."};
            for (int i = 0; i < help.length; i++) instructions.createRow(i).createCell(0).setCellValue(help[i]);
            instructions.setColumnWidth(0, 120 * 256);
            workbook.write(output); return output.toByteArray();
        } catch (IOException ex) { throw failure(503, "SERVICE_UNAVAILABLE"); }
    }
    private QuestionFailure failure(int status, String code) { return new QuestionFailure(status, code); }
}
