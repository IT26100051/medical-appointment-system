package com.medcare.common.documents;

import com.medcare.accesscontrol.Staff;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.doctormanagement.Doctor;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.Notification;
import com.medcare.patientmanagement.Patient;

/**
 * The plain-text data files produced by the system.
 *
 * <p>Each part of the system owns one file so you can open a single file and see
 * exactly what that part stored. Files are written to the folder
 * configured by {@code app.output.dir} (default: {@code ./output} inside the
 * project, so they appear in IntelliJ's project tree).</p>
 */
public enum OutputFile {

    PATIENTS("patient-records.txt", "Patient Records", 1,
            "Every registered patient with profile, contact and emergency-contact details."),

    DOCTORS("doctor-records.txt", "Our Doctors", 2,
            "Every doctor with specialization, qualifications, consultation duration and status."),

    APPOINTMENTS("appointment-records.txt", "Appointments", 3,
            "All appointments with lifecycle status, cancellation and reschedule history."),

    STAFF("staff-accounts.txt", "Staff Accounts", 4,
            "Administrator and receptionist accounts with role, status and last update."),

    SCHEDULES("doctor-schedules.txt", "Doctor Schedules", 5,
            "Every availability slot per doctor and date with its booking status."),

    WAITLIST("waiting-list.txt", "Waiting List", 3,
            "Patients waiting for a free time with a doctor, what was offered and how it ended."),

    FEEDBACK("patient-feedback.txt", "Patient Feedback", 6,
            "Patient feedback with ratings, comments and moderation state."),

    NOTIFICATIONS("notification-inbox.txt", "Notification Inbox", 6,
            "In-app notifications delivered to each user and their read/unread state."),

    AUDIT_LOG("activity-log.txt", "Activity Log", 0,
            "Append-only log: one line per data entry / update / delete performed in the system."),

    SUMMARY("reports/clinic-summary.txt", "Clinic Summary", 0,
            "All components combined in one printable report (counts + full record lists)."),

    LOGIN_ACTIVITY("reports/sign-in-activity.txt", "Sign-in Activity", 4,
            "Append-only record of every successful and failed login attempt.");

    private final String fileName;
    private final String title;
    private final int componentNo;
    private final String description;

    OutputFile(String fileName, String title, int componentNo, String description) {
        this.fileName = fileName;
        this.title = title;
        this.componentNo = componentNo;
        this.description = description;
    }

    public String getFileName() {
        return fileName;
    }

    /**
     * The same name written so it survives inside a web address: the two files
     * that live in the {@code reports} folder keep their folder in the name,
     * spelled with a double underscore. Example:
     * {@code reports/clinic-summary.txt} becomes
     * {@code reports__clinic-summary.txt}.
     */
    public String getKey() {
        return fileName.replace("/", "__");
    }

    public String getTitle() {
        return title;
    }

    public int getComponentNo() {
        return componentNo;
    }

    public String getDescription() {
        return description;
    }
}
