package com.medcare.appointmentmanagement;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentForm;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.feedback.FeedbackRepository;
import com.medcare.feedback.NotificationService;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientRepository;
import com.medcare.patientmanagement.PatientService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 03 - Appointment Management.
 *
 * <p><b>Abstraction / information hiding.</b> Availability checks, ownership
 * checks and the status rules are hidden here. Controllers never write an
 * appointment row and never change a status themselves - they call
 * {@code book}, {@code confirm}, {@code cancel}, {@code complete} or
 * {@code reschedule} and the service applies the rules.</p>
 */
@Service
public class AppointmentService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final AppointmentRepository appointmentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final FeedbackRepository feedbackRepository;
    private final NotificationService notificationService;
    private final WaitlistService waitlistService;
    private final PatientService patientService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              DoctorAvailabilityRepository availabilityRepository,
                              PatientRepository patientRepository,
                              DoctorRepository doctorRepository,
                              FeedbackRepository feedbackRepository,
                              NotificationService notificationService,
                              WaitlistService waitlistService,
                              PatientService patientService,
                              DataExportService exportService,
                              AuditLogService auditLog) {
        this.appointmentRepository = appointmentRepository;
        this.availabilityRepository = availabilityRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.feedbackRepository = feedbackRepository;
        this.notificationService = notificationService;
        this.waitlistService = waitlistService;
        this.patientService = patientService;
        this.exportService = exportService;
        this.auditLog = auditLog;
    }

    // ==================================================================
    //  CREATE - book an appointment on a valid, available slot
    // ==================================================================

    @Transactional
    public Appointment book(AppointmentForm form, User actor) {
        Patient patient = resolvePatient(form, actor);
        Doctor doctor = doctorRepository.findById(form.getDoctorId())
                .orElseThrow(() -> new BusinessRuleException("Please choose a doctor"));

        if (!patient.isActive()) {
            throw new BusinessRuleException("Patient " + patient.getFullName()
                    + " is deactivated and cannot book new appointments");
        }
        if (!doctor.isActive()) {
            throw new BusinessRuleException("Dr. " + doctor.getFullName()
                    + " is not accepting appointments at the moment");
        }

        DoctorAvailability slot = availabilityRepository.findById(form.getSlotId())
                .orElseThrow(() -> new BusinessRuleException("Please choose an available slot"));

        if (!slot.getDoctor().getId().equals(doctor.getId())) {
            throw new BusinessRuleException("The selected slot does not belong to Dr. " + doctor.getFullName());
        }
        if (!slot.isAvailableForBooking()) {
            throw new BusinessRuleException("That slot is " + slot.getStatusLabel().toLowerCase()
                    + " and can no longer be booked");
        }
        LocalDateTime start = LocalDateTime.of(slot.getSlotDate(), slot.getStartTime());
        if (!start.isAfter(LocalDateTime.now())) {
            throw new BusinessRuleException("That slot is in the past - please pick a future slot");
        }

        slot.markBooked();
        availabilityRepository.save(slot);

        Appointment appointment = new Appointment(nextReferenceNo(), patient, doctor, slot,
                slot.getSlotDate(), slot.getStartTime(), slot.getEndTime(), form.getReason(),
                actor.getUsername() + " (" + actor.getRole().name() + ")");
        appointment.changePriority(parsePriority(form.getPriority(), form.getReason()));
        Appointment saved = appointmentRepository.save(appointment);

        refreshExports();
        auditLog.record(3, "CREATE", actor, "Booked " + saved.getReferenceNo() + " for " + patient.getFullName()
                + " with Dr. " + doctor.getFullName() + " on " + DATE.format(saved.getAppointmentDate())
                + " " + TIME.format(saved.getStartTime()) + " (" + saved.getStatus().getLabel() + ")");
        notificationService.appointmentBooked(saved, actor);
        /* the patient now has a real appointment, so their place on this doctor's
           waiting list has served its purpose */
        waitlistService.closePlacesFor(saved);
        /* anybody who was offered this very time is told, and keeps their place */
        waitlistService.releaseTakenOffers(saved);
        return saved;
    }

    /**
     * Finds the patient the appointment is for.
     *
     * <p>Two routes, exactly like a real front desk:</p>
     * <ol>
     *   <li>a registered patient is chosen from the list, or</li>
     *   <li>the person is new - a walk-in - and is written into the patient
     *       register straight from the booking page (name and telephone number
     *       are enough; the receptionist can fill in the rest of the record
     *       later).</li>
     * </ol>
     */
    private Patient resolvePatient(AppointmentForm form, User actor) {
        if (actor.getRole() == UserRole.PATIENT) {
            /* A patient books their own visit. If the page does not name the
               record (or names somebody else's), the rule decides it here, so
               no page can ever book on another person's behalf. */
            if (form.getPatientId() != null && !form.getPatientId().equals(actor.getId())) {
                throw new AccessDeniedException("You can only book appointments for yourself");
            }
            return patientRepository.findById(actor.getId())
                    .orElseThrow(() -> new BusinessRuleException("Your patient record could not be found"));
        }
        if (form.getPatientId() != null) {
            return patientRepository.findById(form.getPatientId())
                    .orElseThrow(() -> new BusinessRuleException("Please choose a registered patient"));
        }
        if (!form.isNewPatient()) {
            throw new BusinessRuleException("Please choose a patient, or enter the details of a new one");
        }
        return patientService.registerWalkIn(form.getNewPatientName(), form.getNewPatientPhone(),
                form.getNewPatientGender(), form.getNewPatientCity(), actor);
    }

    /** Turns the wording from the booking page into the priority stored on the record. */
    private Appointment.Priority parsePriority(String value, String reason) {
        String text = value == null ? "" : value.trim().toLowerCase();
        String hint = reason == null ? "" : reason.trim().toLowerCase();
        if (text.startsWith("urg") || (!text.isEmpty() && text.startsWith("emerg"))) {
            return Appointment.Priority.URGENT;
        }
        if (text.startsWith("follow") || text.startsWith("review") || hint.startsWith("follow up")) {
            return Appointment.Priority.FOLLOW_UP;
        }
        return Appointment.Priority.NORMAL;
    }

    // ==================================================================
    //  READ - role based views
    // ==================================================================

    /** Role based search: patients/doctors only ever see their own appointments. */
    @Transactional(readOnly = true)
    public List<Appointment> search(User actor, Long patientId, Long doctorId, String status,
                                    LocalDate from, LocalDate to, String keyword) {
        Long scopedPatientId = patientId;
        Long scopedDoctorId = doctorId;
        if (actor.getRole() == UserRole.PATIENT) {
            scopedPatientId = actor.getId();
        } else if (actor.getRole() == UserRole.DOCTOR) {
            scopedDoctorId = actor.getId();
        }
        Appointment.Status parsed = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            parsed = Appointment.Status.valueOf(status.toUpperCase());
        }
        return appointmentRepository.search(scopedPatientId, scopedDoctorId, parsed, from, to,
                keyword == null || keyword.isBlank() ? null : keyword.trim());
    }

    @Transactional(readOnly = true)
    public Appointment getRequired(Long id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Appointment", id));
    }

    /** Loads an appointment and proves the caller is allowed to see it. */
    /**
     * Detail screen. The appointment is handed back with its patient and doctor
     * rows already initialised, so the read-only view can be rendered after the
     * transaction has closed (the views only display, they never load data).
     */
    @Transactional(readOnly = true)
    public Appointment detail(Long id, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        Hibernate.initialize(appointment.getPatient());
        Hibernate.initialize(appointment.getDoctor());
        Hibernate.initialize(appointment.getSlot());
        return appointment;
    }

    @Transactional(readOnly = true)
    public Appointment getAuthorised(Long id, User actor) {
        Appointment appointment = getRequired(id);
        if (actor.getRole() == UserRole.PATIENT && !appointment.belongsTo(actor.getId())) {
            throw new AccessDeniedException("This appointment belongs to another patient");
        }
        if (actor.getRole() == UserRole.DOCTOR && !appointment.isScheduledWith(actor.getId())) {
            throw new AccessDeniedException("This appointment belongs to another doctor");
        }
        return appointment;
    }

    @Transactional(readOnly = true)
    public List<Appointment> upcomingFor(User actor, int limit) {
        LocalDate today = LocalDate.now();
        return search(actor, null, null, null, today, today.plusMonths(3), null).stream()
                .filter(a -> a.getStatus().isOpen())
                .limit(limit)
                .toList();
    }

    // ==================================================================
    //  UPDATE - confirm, complete, cancel, reschedule
    // ==================================================================

    @Transactional
    public Appointment confirm(Long id, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        BusinessRuleException.protect(() -> appointment.confirm(actor.getUsername()));
        Appointment saved = appointmentRepository.save(appointment);
        refreshExports();
        auditLog.record(3, "CONFIRM", actor, "Confirmed " + saved.getReferenceNo()
                + " (" + saved.getPatient().getFullName() + " with Dr. " + saved.getDoctor().getFullName()
                + " on " + DATE.format(saved.getAppointmentDate()) + ")");
        notificationService.appointmentConfirmed(saved);
        return saved;
    }

    @Transactional
    public Appointment complete(Long id, String notes, User actor) {
        return complete(id, notes, null, null, null, actor);
    }

    /**
     * Finishes the consultation, writes the visit summary the patient can read
     * afterwards and books (or suggests) the follow-up visit when the doctor
     * asks for one. Kept together here so the rule "a summary belongs to a
     * finished consultation" cannot be broken from a page.
     */
    @Transactional
    public Appointment complete(Long id, String notes, String summary, LocalDate followUpDate,
                                String followUpNotes, User actor) {
        if (followUpDate != null && followUpDate.isBefore(LocalDate.now())) {
            throw new BusinessRuleException("The follow-up date cannot be in the past");
        }
        Appointment appointment = getAuthorised(id, actor);
        appointment.setNotes(notes);
        BusinessRuleException.protect(() -> appointment.completeWithSummary(summary, followUpDate,
                followUpNotes, actor.getUsername()));
        Appointment saved = appointmentRepository.save(appointment);
        refreshExports();
        auditLog.record(3, "COMPLETE", actor, "Completed " + saved.getReferenceNo() + " for "
                + saved.getPatient().getFullName() + " with Dr. " + saved.getDoctor().getFullName()
                + " | notes: " + (notes == null || notes.isBlank() ? "none" : notes)
                + (followUpDate == null ? "" : " | follow-up asked for " + DATE.format(followUpDate)));
        notificationService.appointmentCompleted(saved);
        return saved;
    }

    /** Routine / urgent / follow-up. The clinic can change this at any time before the visit. */
    @Transactional
    public Appointment changePriority(Long id, String priority, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        Appointment.Priority parsed;
        try {
            parsed = Appointment.Priority.valueOf(priority == null ? "NORMAL" : priority.trim().toUpperCase());
        } catch (IllegalArgumentException unknown) {
            throw new BusinessRuleException("Please choose routine, urgent or follow-up");
        }
        appointment.changePriority(parsed);
        Appointment saved = appointmentRepository.save(appointment);
        refreshExports();
        auditLog.record(3, "UPDATE", actor, "Appointment " + saved.getReferenceNo() + " marked as "
                + parsed.getLabel());
        return saved;
    }

    /**
     * Everything the check-in pass needs: who is coming, when, where, with which
     * doctor, and the three things a reception desk asks for on arrival.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> checkInPass(Long id, User actor) {
        Appointment appointment = detail(id, actor);
        Map<String, Object> pass = new java.util.LinkedHashMap<>();
        pass.put("referenceNo", appointment.getReferenceNo());
        pass.put("patientName", appointment.getPatient() == null ? "-" : appointment.getPatient().getFullName());
        pass.put("patientPhone", appointment.getPatient() == null ? null : appointment.getPatient().getPhone());
        pass.put("doctorName", appointment.getDoctor() == null ? "-" : "Dr. " + appointment.getDoctor().getFullName());
        pass.put("specialization", appointment.getDoctor() == null ? null : appointment.getDoctor().getSpecialization());
        pass.put("roomNo", appointment.getDoctor() == null ? null : appointment.getDoctor().getRoomNo());
        pass.put("date", DATE.format(appointment.getAppointmentDate()));
        pass.put("timeLabel", TIME.format(appointment.getStartTime()) + " - " + TIME.format(appointment.getEndTime()));
        pass.put("status", appointment.getStatus().name());
        pass.put("statusLabel", appointment.getStatus().getLabel());
        pass.put("priority", appointment.getPriority().name());
        pass.put("priorityLabel", appointment.getPriority().getLabel());
        pass.put("reason", appointment.getReason());
        pass.put("visitSummary", appointment.getVisitSummary());
        pass.put("followUpDate", appointment.getFollowUpDate() == null ? null : DATE.format(appointment.getFollowUpDate()));
        pass.put("followUpNotes", appointment.getFollowUpNotes());
        pass.put("checkInOpen", appointment.getStatus().isOpen());
        pass.put("arrivalNote", appointment.getStatus().isOpen()
                ? "Please come to the desk 10 minutes before the appointment and show this pass."
                : "This visit is closed - the pass is kept for the record only.");
        return pass;
    }

    /** Cancellation keeps the record as history and immediately frees the slot. */
    @Transactional
    public Appointment cancel(Long id, String reason, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        if (reason == null || reason.isBlank()) {
            throw new BusinessRuleException("A cancellation reason is required");
        }
        // A patient may only cancel an appointment that has not started yet - once the
        // consultation has begun (or finished) the front desk has to handle it.
        if (actor.getRole() == UserRole.PATIENT && !appointment.isInFuture()) {
            throw new BusinessRuleException("This appointment has already taken place and can no longer be "
                    + "cancelled online. Please contact the clinic reception.");
        }
        if (appointment.getStatus() == Appointment.Status.NO_SHOW) {
            throw new BusinessRuleException("An appointment marked as no-show cannot be cancelled");
        }
        BusinessRuleException.protect(() -> appointment.cancel(reason,
                actor.getUsername() + " (" + actor.getRole().name() + ")"));
        Appointment saved = appointmentRepository.save(appointment);
        exportService.refreshSchedules();
        refreshExports();
        auditLog.record(3, "CANCEL", actor, "Cancelled " + saved.getReferenceNo() + " for "
                + saved.getPatient().getFullName() + " - reason: " + reason
                + " (kept as history, slot released)");
        notificationService.appointmentCancelled(saved, actor.getRole().getDisplayName().toLowerCase());
        /* the time is free again: offer it to the patient who has waited longest */
        waitlistService.offerFreedSlot(saved);
        return saved;
    }

    @Transactional
    public Appointment reschedule(Long id, Long newSlotId, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        DoctorAvailability newSlot = availabilityRepository.findById(newSlotId)
                .orElseThrow(() -> new BusinessRuleException("Please choose the new slot"));
        if (!newSlot.isAvailableForBooking()) {
            throw new BusinessRuleException("The selected slot is " + newSlot.getStatusLabel().toLowerCase()
                    + " - please choose another one");
        }
        if (!LocalDateTime.of(newSlot.getSlotDate(), newSlot.getStartTime()).isAfter(LocalDateTime.now())) {
            throw new BusinessRuleException("The selected slot is in the past");
        }
        if (appointment.getDoctor() != null
                && !newSlot.getDoctor().getId().equals(appointment.getDoctor().getId())) {
            throw new BusinessRuleException("Please choose a slot of Dr. " + appointment.getDoctor().getFullName()
                    + " (use cancel + book to change the doctor)");
        }
        String before = DATE.format(appointment.getAppointmentDate()) + " "
                + TIME.format(appointment.getStartTime());
        BusinessRuleException.protect(() -> appointment.reschedule(newSlot, actor.getUsername()));
        appointmentRepository.save(appointment);
        availabilityRepository.save(newSlot);

        refreshExports();
        auditLog.record(3, "RESCHEDULE", actor, "Rescheduled " + appointment.getReferenceNo() + " from " + before
                + " to " + DATE.format(appointment.getAppointmentDate()) + " "
                + TIME.format(appointment.getStartTime()));
        notificationService.appointmentRescheduled(appointment);
        return appointment;
    }

    @Transactional
    public Appointment markNoShow(Long id, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        BusinessRuleException.protect(() -> appointment.markNoShow(actor.getUsername()));
        Appointment saved = appointmentRepository.save(appointment);
        refreshExports();
        auditLog.record(3, "NO-SHOW", actor, "Marked " + saved.getReferenceNo() + " as no-show");
        return saved;
    }

    /** Reopens a completed appointment (correction by the clinic). */
    @Transactional
    public Appointment reopen(Long id, User actor) {
        Appointment appointment = getAuthorised(id, actor);
        if (feedbackRepository.existsByAppointmentId(id)) {
            throw new BusinessRuleException("This appointment already has patient feedback - "
                    + "it cannot be reopened after the patient has reviewed it");
        }
        BusinessRuleException.protect(() -> appointment.reopen(actor.getUsername()));
        Appointment saved = appointmentRepository.save(appointment);
        refreshExports();
        auditLog.record(3, "REOPEN", actor, "Reopened " + saved.getReferenceNo()
                + " (was completed, set back to Confirmed)");
        notificationService.appointmentReopened(saved);
        return saved;
    }

    // ==================================================================
    //  DELETE - cancelled appointments are history, only test data is removed
    // ==================================================================

    @Transactional
    public String delete(Long id, User actor) {
        Appointment appointment = getRequired(id);
        if (appointment.getStatus().isOpen()) {
            throw new BusinessRuleException("An active appointment cannot be deleted - cancel it first "
                    + "so the cancellation is kept as history");
        }
        String summary = appointment.getReferenceNo() + " (" + appointment.getPatient().getFullName()
                + ", " + appointment.getStatus().getLabel() + ")";
        if (appointment.getSlot() != null) {
            appointment.detachSlot();
            availabilityRepository.save(appointment.getSlot());
        }
        appointmentRepository.delete(appointment);
        exportService.refreshSchedules();
        refreshExports();
        auditLog.record(3, "DELETE", actor, "Deleted finished appointment " + summary
                + " - approved test data removal");
        return "Appointment " + summary + " removed from the system.";
    }

    // ==================================================================
    //  Helpers
    // ==================================================================

    private void refreshExports() {
        exportService.refreshAppointments();
        exportService.refreshSummary();
    }

    /** Sequential reference number, e.g. {@code APT-20261007-004}. */
    private String nextReferenceNo() {
        String day = DATE.format(LocalDate.now()).replace("-", "");
        java.util.Set<String> existing = appointmentRepository.findAll().stream()
                .map(Appointment::getReferenceNo)
                .collect(java.util.stream.Collectors.toSet());
        long sequence = existing.size() + 1;
        while (true) {
            String candidate = String.format("APT-%s-%03d", day, sequence++);
            if (!existing.contains(candidate)) {
                return candidate;
            }
        }
    }
}
