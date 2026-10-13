package com.medcare.common.documents;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.documents.OutputFile;
import com.medcare.common.documents.TextFileService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.security.RequireRole;
import com.medcare.common.web.BaseController;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The "data in / data out" screen.
 *
 * <p>Lists every text file the system produced, shows its content in the browser
 * and allows it to be downloaded or regenerated. This is the page to open when
 * you have to prove that the input data was captured and stored.</p>
 *
 * <p>These are the clinic's internal records, so only the system administrator
 * may open them - not the front desk, not a doctor and never a patient.</p>
 */
@RestController
@RequestMapping("/api/reports")
@RequireRole({UserRole.ADMIN})
public class ReportController extends BaseController {

    private final TextFileService textFileService;
    private final DataExportService exportService;

    public ReportController(TextFileService textFileService, DataExportService exportService,
                            AccountService accountService) {
        super(accountService);
        this.textFileService = textFileService;
        this.exportService = exportService;
    }

    /** Metadata + short preview of every managed file. */
    @GetMapping
    public Map<String, Object> list() {
        List<Map<String, Object>> files = new ArrayList<>();
        for (OutputFile file : OutputFile.values()) {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("fileName", file.getFileName());
            meta.put("key", file.getKey());
            meta.put("title", file.getTitle());
            meta.put("order", file.getComponentNo());
            meta.put("description", file.getDescription());
            meta.put("exists", textFileService.exists(file));
            meta.put("sizeBytes", textFileService.sizeOf(file));
            meta.put("lastModified", textFileService.lastModified(file));
            meta.put("lineCount", textFileService.exists(file) ? textFileService.read(file).lines().count() : 0);
            meta.put("preview", textFileService.exists(file)
                    ? textFileService.readLines(file, 14) : List.of());
            files.add(meta);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outputDir", textFileService.getBaseDir().toString());
        body.put("files", files);
        return body;
    }

    /** Full content of one file, rendered in the page. */
    @GetMapping("/{fileName}/content")
    public Map<String, Object> content(@PathVariable String fileName) {
        OutputFile file = resolve(fileName);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fileName", file.getFileName());
        body.put("key", file.getKey());
        body.put("title", file.getTitle());
        body.put("content", textFileService.read(file));
        body.put("lastModified", textFileService.lastModified(file));
        return body;
    }

    /** Download the raw .txt file. */
    @GetMapping("/{fileName}/download")
    public ResponseEntity<Resource> download(@PathVariable String fileName) {
        OutputFile file = resolve(fileName);
        byte[] bytes = textFileService.read(file).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + java.nio.file.Paths.get(file.getFileName()).getFileName() + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    /** Regenerates every component file from the current database contents. */
    @PostMapping("/refresh")
    @RequireRole({UserRole.ADMIN})
    public Map<String, Object> refresh() {
        exportService.refreshAll();
        return Map.of("message", "All text reports regenerated from the current data",
                "outputDir", textFileService.getBaseDir().toString());
    }

    /**
     * A file may be asked for by its address-safe key ({@code reports__clinic-summary.txt}),
     * by its plain name ({@code patient-records.txt}) or by the constant
     * ({@code PATIENTS}) - whichever the page happens to hold.
     */
    private OutputFile resolve(String fileName) {
        String wanted = fileName == null ? "" : fileName.trim();
        return Arrays.stream(OutputFile.values())
                .filter(f -> f.getKey().equalsIgnoreCase(wanted)
                        || f.getFileName().equalsIgnoreCase(wanted)
                        || f.name().equalsIgnoreCase(wanted))
                .findFirst()
                .orElseThrow(() -> new com.medcare.common.exception.ResourceNotFoundException(
                        "Unknown report file: " + fileName));
    }
}
