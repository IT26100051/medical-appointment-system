package com.medcare.common.documents;

import com.medcare.common.documents.OutputFile;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.doctormanagement.Doctor;
import com.medcare.availability.DoctorAvailability;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.Notification;
import com.medcare.patientmanagement.Patient;
import com.medcare.accesscontrol.Staff;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.feedback.FeedbackRepository;
import com.medcare.feedback.NotificationRepository;
import com.medcare.patientmanagement.PatientRepository;
import com.medcare.accesscontrol.UserRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes the readable text files that prove what the system stored.
 *
 * <p>After every create / update / delete operation the matching component file
 * is regenerated from the database, so the files are always a faithful snapshot
 * of the current data. The combined summary report is regenerated as well, and
 * the append-only audit log keeps the full history.</p>
 */
@Service
public class DataExportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final String DIVIDER = "-".repeat(76);
    private static final String THIN = "  " + ".".repeat(70);

    private final TextFileService text;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final FeedbackRepository feedbackRepository;
    private final NotificationRepository notificationRepository;
    private final com.medcare.appointmentmanagement.WaitlistRepository waitlistRepository;

    public DataExportService(TextFileService text,
                             PatientRepository patientRepository,
                             DoctorRepository doctorRepository,
                             UserRepository userRepository,
                             AppointmentRepository appointmentRepository,
                             DoctorAvailabilityRepository availabilityRepository,
                             FeedbackRepository feedbackRepository,
                             NotificationRepository notificationRepository,
                             com.medcare.appointmentmanagement.WaitlistRepository waitlistRepository) {
        this.text = text;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.availabilityRepository = availabilityRepository;
        this.feedbackRepository = feedbackRepository;
        this.notificationRepository = notificationRepository;
        this.waitlistRepository = waitlistRepository;
    }

    // ==================================================================
    //  Component files
    // ==================================================================

    @Transactional(readOnly = true)
    public void refreshPatients() {
        List<Patient> patients = patientRepository.findAll(Sort.by("fullName"));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.PATIENTS.getTitle(),
                OutputFile.PATIENTS.getFileName(), patients.size()));
        if (patients.isEmpty()) {
            sb.append("  (no patient records yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (Patient p : patients) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Patient ID", p.getId()));
            sb.append(line("Full name", p.getFullName()));
            sb.append(line("Account type", p.getAccountType()));
            sb.append(line("Username", p.getUsername()));
            sb.append(line("E-mail", p.getEmail()));
            sb.append(line("Phone", p.getPhone()));
            sb.append(line("Date of birth", p.getDateOfBirth() == null ? null : DATE_FMT.format(p.getDateOfBirth())));
            sb.append(line("Age", p.age()));
            sb.append(line("Gender", p.getGender()));
            sb.append(line("NIC", p.getNic()));
            sb.append(line("Address", p.getAddress()));
            sb.append(line("City", p.getCity()));
            sb.append(line("Blood group", p.getBloodGroup()));
            sb.append(line("Emergency contact", p.getEmergencyContactName()));
            sb.append(line("Emergency phone", p.getEmergencyContactPhone()));
            sb.append(line("Medical notes", p.getMedicalNotes()));
            sb.append(line("Account status", p.getStatusLabel()));
            sb.append(line("Registered at", p.getCreatedAt()));
            sb.append(line("Last updated", p.getUpdatedAt() == null ? "never" : p.getUpdatedAt()));
            sb.append(line("Profile summary", p.getProfileSummary()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.PATIENTS, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshDoctors() {
        List<Doctor> doctors = doctorRepository.findAll(Sort.by("fullName"));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.DOCTORS.getTitle(),
                OutputFile.DOCTORS.getFileName(), doctors.size()));
        if (doctors.isEmpty()) {
            sb.append("  (no doctor records yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (Doctor d : doctors) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Doctor ID", d.getId()));
            sb.append(line("Full name", "Dr. " + d.getFullName()));
            sb.append(line("Specialization", d.getSpecialization()));
            sb.append(line("Qualifications", d.getQualifications()));
            sb.append(line("SLMC registration", d.getRegistrationNo()));
            sb.append(line("Consultation duration", d.getConsultationMinutes() + " minutes"));
            sb.append(line("Consultation fee", d.getConsultationFee() == null
                    ? null : String.format(Locale.ROOT, "%.2f", d.getConsultationFee())));
            sb.append(line("Room", d.getRoomNo()));
            sb.append(line("Username", d.getUsername()));
            sb.append(line("E-mail", d.getEmail()));
            sb.append(line("Phone", d.getPhone()));
            sb.append(line("Account status", d.getStatusLabel()));
            sb.append(line("Appointments booked", appointmentRepository.countDistinctPatientsByDoctor(d.getId())
                    + " distinct patient(s)"));
            sb.append(line("Average rating", ratingText(d.getId())));
            sb.append(line("Profile summary", d.getProfileSummary()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.DOCTORS, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshStaff() {
        List<User> staff = userRepository.searchStaff(null);
        StringBuilder sb = new StringBuilder(text.header(OutputFile.STAFF.getTitle(),
                OutputFile.STAFF.getFileName(), staff.size()));
        if (staff.isEmpty()) {
            sb.append("  (no staff accounts yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (User u : staff) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("User ID", u.getId()));
            sb.append(line("Full name", u.getFullName()));
            sb.append(line("Role", u.getRole().name() + " - " + u.getRole().getDisplayName()));
            sb.append(line("Role permissions", u.getRole().getDescription()));
            if (u instanceof Staff s) {
                sb.append(line("Designation", s.getDesignation()));
                sb.append(line("Employee code", s.getEmployeeCode()));
                sb.append(line("Counter no", s.getCounterNo()));
            }
            sb.append(line("Username", u.getUsername()));
            sb.append(line("E-mail", u.getEmail()));
            sb.append(line("Phone", u.getPhone()));
            sb.append(line("Account status", u.getStatusLabel()));
            sb.append(line("Created at", u.getCreatedAt()));
            sb.append(line("Last updated", u.getUpdatedAt() == null ? "never" : u.getUpdatedAt()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.STAFF, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshAppointments() {
        List<Appointment> appointments = appointmentRepository.findAll(
                Sort.by(Sort.Order.desc("appointmentDate"), Sort.Order.desc("startTime")));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.APPOINTMENTS.getTitle(),
                OutputFile.APPOINTMENTS.getFileName(), appointments.size()));
        if (appointments.isEmpty()) {
            sb.append("  (no appointments yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (Appointment a : appointments) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Reference no", a.getReferenceNo()));
            sb.append(line("Patient", a.getPatient() == null ? "-"
                    : a.getPatient().getFullName() + " (#" + a.getPatient().getId() + ")"));
            sb.append(line("Doctor", a.getDoctor() == null ? "-"
                    : "Dr. " + a.getDoctor().getFullName() + " (" + a.getDoctor().getSpecialization() + ")"));
            sb.append(line("Date", DATE_FMT.format(a.getAppointmentDate())));
            sb.append(line("Time", TIME_FMT.format(a.getStartTime()) + " - " + TIME_FMT.format(a.getEndTime())));
            sb.append(line("Status", a.getStatus().name() + " (" + a.getStatus().getDescription() + ")"));
            sb.append(line("Reason", a.getReason()));
            sb.append(line("Clinic notes", a.getNotes()));
            sb.append(line("Cancellation reason", a.getCancellationReason()));
            sb.append(line("Cancelled by", a.getCancelledBy()));
            sb.append(line("Booked by", a.getCreatedBy()));
            sb.append(line("Booked at", a.getCreatedAt()));
            sb.append(line("Last updated", a.getUpdatedAt() == null ? "never" : a.getUpdatedAt()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.APPOINTMENTS, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshSchedules() {
        List<DoctorAvailability> slots = availabilityRepository.findAll(
                Sort.by(Sort.Order.asc("slotDate"), Sort.Order.asc("startTime")));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.SCHEDULES.getTitle(),
                OutputFile.SCHEDULES.getFileName(), slots.size()));
        if (slots.isEmpty()) {
            sb.append("  (no availability slots yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (DoctorAvailability s : slots) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Slot ID", s.getId()));
            sb.append(line("Doctor", s.getDoctor() == null ? "-"
                    : "Dr. " + s.getDoctor().getFullName() + " - " + s.getDoctor().getSpecialization()));
            sb.append(line("Date", DATE_FMT.format(s.getSlotDate())));
            sb.append(line("Time", TIME_FMT.format(s.getStartTime()) + " - " + TIME_FMT.format(s.getEndTime())));
            sb.append(line("Status", s.getStatus().name() + " (" + s.getStatus().getDescription() + ")"));
            sb.append(line("Remarks", s.getRemarks()));
            sb.append(line("Bookable now", s.isAvailableForBooking() ? "YES" : "NO"));
            sb.append(line("Deletion allowed", s.isDeleteAllowed() ? "YES" : "NO - booked slots are kept"));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.SCHEDULES, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshFeedback() {
        List<Feedback> feedback = feedbackRepository.findAll(Sort.by(Sort.Order.desc("createdAt")));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.FEEDBACK.getTitle(),
                OutputFile.FEEDBACK.getFileName(), feedback.size()));
        if (feedback.isEmpty()) {
            sb.append("  (no feedback submitted yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (Feedback f : feedback) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Feedback ID", f.getId()));
            sb.append(line("Appointment", f.getAppointment() == null ? "-" : f.getAppointment().getReferenceNo()));
            sb.append(line("Patient", f.getPatient() == null ? "-" : f.getPatient().getFullName()));
            sb.append(line("Doctor", f.getDoctor() == null ? "-" : "Dr. " + f.getDoctor().getFullName()));
            sb.append(line("Rating", f.getRating() + " / 5  " + stars(f.getRating())));
            sb.append(line("Comments", f.getComments()));
            sb.append(line("Moderation", f.getModeration().name()));
            sb.append(line("Moderation note", f.getModerationNote()));
            sb.append(line("Submitted at", f.getCreatedAt()));
            sb.append(line("Last edited", f.getUpdatedAt() == null ? "never" : f.getUpdatedAt()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.FEEDBACK, sb.toString());
    }

    @Transactional(readOnly = true)
    public void refreshNotifications() {
        List<Notification> notifications = notificationRepository.findAll(Sort.by(Sort.Order.desc("createdAt")));
        StringBuilder sb = new StringBuilder(text.header(OutputFile.NOTIFICATIONS.getTitle(),
                OutputFile.NOTIFICATIONS.getFileName(), notifications.size()));
        if (notifications.isEmpty()) {
            sb.append("  (no notifications yet)").append(System.lineSeparator());
        }
        int index = 1;
        for (Notification n : notifications) {
            sb.append("  [").append(String.format("%02d", index++)).append("] ").append(DIVIDER).append('\n');
            sb.append(line("Notification ID", n.getId()));
            sb.append(line("Recipient id", n.getRecipientId() + " (" + n.getRecipientRole() + ")"));
            sb.append(line("Type", n.getType().name() + " - " + n.getType().getLabel()));
            sb.append(line("Title", n.getTitle()));
            sb.append(line("Message", n.getMessage()));
            sb.append(line("Appointment id", n.getRelatedAppointmentId()));
            sb.append(line("Read", n.isRead() ? "YES" : "NO (unread)"));
            sb.append(line("Created at", n.getCreatedAt()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.NOTIFICATIONS, sb.toString());
    }

    /** The waiting list: who is waiting, for whom, what was offered and how it ended. */
    @Transactional(readOnly = true)
    public void refreshWaitlist() {
        List<com.medcare.appointmentmanagement.WaitlistEntry> entries =
                waitlistRepository.findAll(Sort.by("createdAt").ascending());
        StringBuilder sb = new StringBuilder(text.header(OutputFile.WAITLIST.getTitle(),
                OutputFile.WAITLIST.getFileName(), entries.size()));
        sb.append(DIVIDER).append(System.lineSeparator());
        for (com.medcare.appointmentmanagement.WaitlistEntry entry : entries) {
            sb.append(line("Waiting-list entry", "#" + entry.getId()));
            sb.append(line("Patient", entry.getPatient().getFullName()
                    + "  (record #" + entry.getPatient().getId() + ")"));
            sb.append(line("Telephone", entry.getPatient().getPhone()));
            sb.append(line("Doctor", "Dr. " + entry.getDoctor().getFullName()
                    + "  (" + entry.getDoctor().getSpecialization() + ")"));
            sb.append(line("Can come", entry.getWindowLabel()));
            sb.append(line("Note", entry.getNote()));
            sb.append(line("Status", entry.getStatus().name() + " - " + entry.getStatusLabel()));
            sb.append(line("Offered time", entry.getOfferedTime()));
            sb.append(line("Offered at", entry.getOfferedStamp()));
            sb.append(line("Joined at", entry.getCreatedStamp()));
            sb.append(System.lineSeparator());
        }
        text.write(OutputFile.WAITLIST, sb.toString());
    }

    /** Regenerates every component file plus the combined summary. */
    @Transactional(readOnly = true)
    public void refreshAll() {
        refreshPatients();
        refreshDoctors();
        refreshStaff();
        refreshAppointments();
        refreshSchedules();
        refreshFeedback();
        refreshNotifications();
        refreshWaitlist();
        refreshSummary();
    }

    // ==================================================================
    //  Combined summary report
    // ==================================================================

    @Transactional(readOnly = true)
    public void refreshSummary() {
        long patients = patientRepository.count();
        long activePatients = patientRepository.countByActiveTrue();
        long doctors = doctorRepository.count();
        long activeDoctors = doctorRepository.countByActiveTrue();
        long staff = userRepository.countByRole(UserRole.ADMIN) + userRepository.countByRole(UserRole.RECEPTIONIST);
        long pending = appointmentRepository.countByStatus(Appointment.Status.PENDING);
        long confirmed = appointmentRepository.countByStatus(Appointment.Status.CONFIRMED);
        long completed = appointmentRepository.countByStatus(Appointment.Status.COMPLETED);
        long cancelled = appointmentRepository.countByStatus(Appointment.Status.CANCELLED);
        long noShow = appointmentRepository.countByStatus(Appointment.Status.NO_SHOW);
        long slots = availabilityRepository.count();
        long availableSlots = availabilityRepository.countByStatus(DoctorAvailability.SlotStatus.AVAILABLE);
        long bookedSlots = availabilityRepository.countByStatus(DoctorAvailability.SlotStatus.BOOKED);
        long blockedSlots = availabilityRepository.countByStatus(DoctorAvailability.SlotStatus.BLOCKED);
        long feedbackCount = feedbackRepository.count();
        Double avgRating = feedbackRepository.averageRating(null);
        long unread = notificationRepository.countByReadFlagFalse();
        long todayAppointments = appointmentRepository.countByAppointmentDate(java.time.LocalDate.now());

        StringBuilder sb = new StringBuilder();
        String bar = "=".repeat(78);
        sb.append(bar).append('\n');
        sb.append("  MEDICAL APPOINTMENT SCHEDULING SYSTEM - SYSTEM SUMMARY REPORT\n");
        sb.append(bar).append('\n');
        sb.append("  Generated : ").append(TextFileService.STAMP.format(LocalDateTime.now())).append('\n');
        sb.append("  Purpose   : Combined snapshot of the whole clinic\n");
        sb.append(bar).append('\n').append('\n');

        sb.append("  1. RECORD COUNTS AT A GLANCE\n").append(THIN).append('\n');
        sb.append(rstat("Patients registered", patients + "  (active: " + activePatients + ")"));
        sb.append(rstat("Doctors registered", doctors + "  (active: " + activeDoctors + ")"));
        sb.append(rstat("Administrator / receptionist accounts", String.valueOf(staff)));
        sb.append(rstat("Appointments - pending", String.valueOf(pending)));
        sb.append(rstat("Appointments - confirmed", String.valueOf(confirmed)));
        sb.append(rstat("Appointments - completed", String.valueOf(completed)));
        sb.append(rstat("Appointments - cancelled (history kept)", String.valueOf(cancelled)));
        sb.append(rstat("Appointments - no show", String.valueOf(noShow)));
        sb.append(rstat("Appointments on " + java.time.LocalDate.now(), String.valueOf(todayAppointments)));
        sb.append(rstat("Availability slots - available", String.valueOf(availableSlots)));
        sb.append(rstat("Availability slots - booked", String.valueOf(bookedSlots)));
        sb.append(rstat("Availability slots - blocked", String.valueOf(blockedSlots)));
        sb.append(rstat("Availability slots - total", String.valueOf(slots)));
        sb.append(rstat("Patients on the waiting list",
                String.valueOf(waitlistRepository.countByStatus(
                        com.medcare.appointmentmanagement.WaitlistEntry.Status.WAITING))));
        sb.append(rstat("Feedback entries", String.valueOf(feedbackCount)));
        sb.append(rstat("Average doctor rating", avgRating == null
                ? "no ratings yet" : String.format(Locale.ROOT, "%.2f / 5.00", avgRating)));
        sb.append(rstat("Unread notifications", String.valueOf(unread)));
        sb.append('\n');

        sb.append("  2. RECENT AUDIT TRAIL (last 25 recorded actions)\n").append(THIN).append('\n');
        List<String> audit = text.exists(OutputFile.AUDIT_LOG)
                ? text.read(OutputFile.AUDIT_LOG).lines()
                        .filter(l -> l.contains("|"))
                        .skip(Math.max(0, text.read(OutputFile.AUDIT_LOG).lines()
                                .filter(l -> l.contains("|")).count() - 25))
                        .toList()
                : List.of();
        if (audit.isEmpty()) {
            sb.append("  (no actions recorded yet)\n");
        } else {
            for (String a : audit) {
                sb.append("  ").append(a).append('\n');
            }
        }
        sb.append('\n');

        sb.append("  3. COMPONENT FILES PRODUCED BY THIS RUN\n").append(THIN).append('\n');
        for (OutputFile f : OutputFile.values()) {
            if (f == OutputFile.SUMMARY) {
                continue;
            }
            sb.append(rstat(f.getFileName(),
                    text.exists(f) ? text.sizeOf(f) + " bytes, last written " + text.lastModified(f) : "not written yet"));
        }
        sb.append('\n');
        sb.append(bar).append('\n');
        sb.append("  Open the individual documents for the full record listings:\n");
        sb.append("    documents/patient-records.txt        documents/doctor-records.txt\n");
        sb.append("    documents/appointment-records.txt    documents/staff-accounts.txt\n");
        sb.append("    documents/doctor-schedules.txt\n");
        sb.append("    documents/patient-feedback.txt       documents/notification-inbox.txt\n");
        sb.append("    documents/activity-log.txt           documents/reports/sign-in-activity.txt\n");
        sb.append(bar).append('\n');
        text.write(OutputFile.SUMMARY, sb.toString());
    }

    // ==================================================================
    //  Formatting helpers
    // ==================================================================

    private String line(String label, Object value) {
        String text;
        if (value instanceof LocalDateTime stamp) {
            text = TextFileService.STAMP.format(stamp);          // 2026-10-07 10:21:31
        } else {
            text = value == null || "".equals(value) ? "(not provided)" : String.valueOf(value);
        }
        return String.format("       %-22s: %s%n", label, text);
    }

    private String rstat(String label, String value) {
        return String.format("     %-40s : %s%n", label, value);
    }

    private String stars(Integer rating) {
        if (rating == null) {
            return "";
        }
        return "*".repeat(rating) + "-".repeat(5 - rating);
    }

    private String ratingText(Long doctorId) {
        Double avg = feedbackRepository.averageRating(doctorId);
        return avg == null ? "no ratings yet" : String.format(Locale.ROOT, "%.2f / 5.00", avg);
    }
}
