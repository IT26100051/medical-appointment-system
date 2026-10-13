package com.medcare.common.documents;

import com.medcare.common.documents.OutputFile;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Low level text file helper - the input/output evidence layer of the project.
 *
 * <p>All files live under the folder configured in {@code app.output.dir}
 * (default {@code output/} in the project root) in UTF-8 plain text, so they can
 * be opened with Notepad, printed, or attached to a report.</p>
 */
@Service
public class TextFileService {

    public static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final Path baseDir;

    public TextFileService(@Value("${app.output.dir:output}") String outputDir) {
        this.baseDir = Paths.get(outputDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(baseDir);
            Files.createDirectories(baseDir.resolve("reports"));
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to create the output folder: " + baseDir, ex);
        }
    }

    public Path getBaseDir() {
        return baseDir;
    }

    public Path pathOf(OutputFile file) {
        return baseDir.resolve(file.getFileName());
    }

    /** Overwrites a file with a fresh snapshot. */
    public void write(OutputFile file, String content) {
        writeRaw(file, content);
    }

    public void writeRaw(OutputFile file, String content) {
        try {
            Path target = pathOf(file);
            Files.createDirectories(target.getParent());
            Files.writeString(target, content, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to write " + file.getFileName(), ex);
        }
    }

    /** Appends one line (used for append-only history files). */
    public void append(OutputFile file, String line) {
        try {
            Path target = pathOf(file);
            Files.createDirectories(target.getParent());
            if (!Files.exists(target)) {
                Files.writeString(target, headerFor(file), StandardCharsets.UTF_8, StandardOpenOption.CREATE);
            }
            Files.writeString(target, line + System.lineSeparator(), StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to append to " + file.getFileName(), ex);
        }
    }

    public String read(OutputFile file) {
        Path target = pathOf(file);
        if (!Files.exists(target)) {
            return "(The file " + file.getFileName() + " does not exist yet - perform an action in the system first.)";
        }
        try {
            return Files.readString(target, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException("Unable to read " + file.getFileName(), ex);
        }
    }

    public List<String> readLines(OutputFile file, int maxLines) {
        return read(file).lines().limit(maxLines).toList();
    }

    public boolean exists(OutputFile file) {
        return Files.exists(pathOf(file));
    }

    public long sizeOf(OutputFile file) {
        try {
            Path target = pathOf(file);
            return Files.exists(target) ? Files.size(target) : 0L;
        } catch (IOException ex) {
            return 0L;
        }
    }

    public String lastModified(OutputFile file) {
        try {
            Path target = pathOf(file);
            if (!Files.exists(target)) {
                return "-";
            }
            return STAMP.format(LocalDateTime.ofInstant(
                    Files.getLastModifiedTime(target).toInstant(), java.time.ZoneId.systemDefault()));
        } catch (IOException ex) {
            return "-";
        }
    }

    /** Standard banner used at the top of every snapshot file. */
    public String header(String title, String fileName, int recordCount) {
        String line = "=".repeat(78);
        StringBuilder sb = new StringBuilder();
        sb.append(line).append(System.lineSeparator());
        sb.append("  MEDICAL APPOINTMENT SCHEDULING SYSTEM").append(System.lineSeparator());
        sb.append("  ").append(title).append(System.lineSeparator());
        sb.append(line).append(System.lineSeparator());
        sb.append("  File      : ").append(fileName).append(System.lineSeparator());
        sb.append("  Generated : ").append(STAMP.format(LocalDateTime.now())).append(System.lineSeparator());
        sb.append("  Records   : ").append(recordCount).append(System.lineSeparator());
        sb.append(line).append(System.lineSeparator());
        sb.append(System.lineSeparator());
        return sb.toString();
    }

    private String headerFor(OutputFile file) {
        String line = "=".repeat(78);
        return line + System.lineSeparator()
                + "  " + file.getTitle().toUpperCase() + System.lineSeparator()
                + "  File: " + file.getFileName() + "   (append-only history)" + System.lineSeparator()
                + "  Columns: timestamp | area | action | by whom | details" + System.lineSeparator()
                + line + System.lineSeparator();
    }
}
