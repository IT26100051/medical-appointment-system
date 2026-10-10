package com.medcare.common.audit;

import com.medcare.common.documents.OutputFile;
import com.medcare.common.documents.TextFileService;
import com.medcare.common.domain.User;
import com.medcare.patientmanagement.Patient;
import java.time.LocalDateTime;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Append-only audit trail.
 *
 * <p>Every create / update / delete / login action performed anywhere in the
 * system is recorded with a single line containing the timestamp, the
 * component, the action, who did it and the affected record. This is the file
 * to open when a marker asks "show me the data going in and coming out".</p>
 */
@Service
public class AuditLogService {

    private final TextFileService textFileService;
    private final boolean enabled;

    public AuditLogService(TextFileService textFileService,
                           @Value("${app.audit.enabled:true}") boolean enabled) {
        this.textFileService = textFileService;
        this.enabled = enabled;
    }

    /** Records one action, e.g. {@code record(1, "CREATE", user, "Patient #4 - Nimal Silva")}. */
    private static final String[] AREA = {
            "General", "Patients", "Doctors", "Appointments", "Staff & access", "Schedules", "Feedback"};
    public void record(int componentNo, String action, User actor, String details) {
        if (!enabled) {
            return;
        }
        String actorText = actor == null
                ? "system (SYSTEM)"
                : actor.getUsername() + " (" + actor.getRole().name() + ")";
        recordRaw(componentNo, action, actorText, details, OutputFile.AUDIT_LOG);
    }

    /** Same as {@link #record} but for the login report (system actor). */
    public void recordLogin(String action, String actorText, String details) {
        if (!enabled) {
            return;
        }
        recordRaw(4, action, actorText, details, OutputFile.AUDIT_LOG);
        recordRaw(4, action, actorText, details, OutputFile.LOGIN_ACTIVITY);
    }

    private void recordRaw(int componentNo, String action, String actorText, String details, OutputFile file) {
        String line = String.format(Locale.ROOT, "%s | %-13s | %-8s | %-32s | %s",
                TextFileService.STAMP.format(LocalDateTime.now()),
                AREA[Math.max(0, Math.min(componentNo, AREA.length - 1))],
                action,
                shorten(actorText, 32),
                details);
        textFileService.append(file, line);
    }

    private String shorten(String value, int max) {
        if (value == null) {
            return "-";
        }
        return value.length() <= max ? value : value.substring(0, max - 3) + "...";
    }
}
