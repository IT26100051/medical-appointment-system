package com.medcare.feedback;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.FeedbackForm;
import com.medcare.feedback.FeedbackRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 06 - Feedback Management.
 *
 * <p><b>Abstraction.</b> Eligibility ("only for a completed appointment, only
 * once"), moderation and rating rules are centralised here. The pages only send
 * a rating and a comment.</p>
 */
@Service
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final AppointmentRepository appointmentRepository;
    private final NotificationService notificationService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;

    public FeedbackService(FeedbackRepository feedbackRepository,
                           AppointmentRepository appointmentRepository,
                           NotificationService notificationService,
                           DataExportService exportService,
                           AuditLogService auditLog) {
        this.feedbackRepository = feedbackRepository;
        this.appointmentRepository = appointmentRepository;
        this.notificationService = notificationService;
        this.exportService = exportService;
        this.auditLog = auditLog;
    }

    // ---------------- CREATE ----------------

    /** Appointments the logged-in patient may still review. */
    @Transactional(readOnly = true)
    public List<Appointment> eligibleAppointments(Long patientId) {
        return appointmentRepository.findCompletedWithoutFeedback(patientId);
    }

    @Transactional
    public Feedback submit(FeedbackForm form, User actor) {
        Appointment appointment = appointmentRepository.findById(form.getAppointmentId())
                .orElseThrow(() -> ResourceNotFoundException.of("Appointment", form.getAppointmentId()));

        if (actor.getRole() == UserRole.PATIENT && !appointment.belongsTo(actor.getId())) {
            throw new AccessDeniedException("You can only review your own consultations");
        }
        if (appointment.getStatus() != Appointment.Status.COMPLETED) {
            throw new BusinessRuleException("Feedback can only be submitted after the appointment is completed");
        }
        if (feedbackRepository.existsByAppointmentId(appointment.getId())) {
            throw new BusinessRuleException("Feedback has already been submitted for this appointment");
        }

        Feedback feedback = new Feedback(appointment, form.getRating(), form.getComments());
        Feedback saved = feedbackRepository.save(feedback);
        exportService.refreshFeedback();
        exportService.refreshSummary();
        auditLog.record(6, "CREATE", actor, "Feedback #" + saved.getId() + " submitted for "
                + appointment.getReferenceNo() + " - rating " + saved.getRating() + "/5, doctor Dr. "
                + saved.getDoctor().getFullName());
        notificationService.feedbackReceived(saved);
        return saved;
    }

    // ---------------- READ ----------------

    @Transactional(readOnly = true)
    public List<Feedback> search(User actor, Long doctorId, Long patientId, String moderation, String keyword) {
        Long scopedDoctorId = doctorId;
        Long scopedPatientId = patientId;
        if (actor.getRole() == UserRole.DOCTOR) {
            scopedDoctorId = actor.getId();
        } else if (actor.getRole() == UserRole.PATIENT) {
            scopedPatientId = actor.getId();
        }
        Feedback.Moderation parsed = null;
        if (moderation != null && !moderation.isBlank() && !"ALL".equalsIgnoreCase(moderation)) {
            parsed = Feedback.Moderation.valueOf(moderation.toUpperCase());
        }
        return feedbackRepository.search(scopedDoctorId, scopedPatientId, parsed,
                keyword == null || keyword.isBlank() ? null : keyword.trim());
    }

    /** Public, visible feedback shown in the doctor profile. */
    @Transactional(readOnly = true)
    public List<Feedback> visibleForDoctor(Long doctorId) {
        return feedbackRepository.search(doctorId, null, Feedback.Moderation.VISIBLE, null);
    }

    @Transactional(readOnly = true)
    public Feedback getRequired(Long id) {
        return feedbackRepository.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Feedback", id));
    }

    @Transactional(readOnly = true)
    public Double averageRating(Long doctorId) {
        return feedbackRepository.averageRating(doctorId);
    }

    // ---------------- UPDATE ----------------

    @Transactional
    public Feedback edit(Long id, FeedbackForm form, User actor) {
        Feedback feedback = getRequired(id);
        boolean author = actor.getId().equals(feedback.getPatient().getId());
        boolean admin = actor.getRole() == UserRole.ADMIN;
        if (!author && !admin) {
            throw new AccessDeniedException("You can only edit your own feedback");
        }
        feedback.edit(form.getRating(), form.getComments());
        Feedback saved = feedbackRepository.save(feedback);
        exportService.refreshFeedback();
        auditLog.record(6, "UPDATE", actor, "Feedback #" + id + " edited - new rating "
                + saved.getRating() + "/5 for " + saved.getAppointment().getReferenceNo());
        return saved;
    }

    /** Hide (moderate) - done by the reviewed doctor or an administrator. */
    @Transactional
    public Feedback hide(Long id, String note, User actor) {
        Feedback feedback = getRequired(id);
        boolean reviewedDoctor = feedback.isModeratedBy(actor.getId());
        boolean admin = actor.getRole() == UserRole.ADMIN;
        if (!reviewedDoctor && !admin) {
            throw new AccessDeniedException("Only the reviewed doctor or an administrator can hide feedback");
        }
        feedback.hide(note);
        Feedback saved = feedbackRepository.save(feedback);
        exportService.refreshFeedback();
        auditLog.record(6, "HIDE", actor, "Feedback #" + id + " hidden - note: "
                + (note == null || note.isBlank() ? "none" : note));
        return saved;
    }

    @Transactional
    public Feedback restore(Long id, User actor) {
        Feedback feedback = getRequired(id);
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Only an administrator can restore hidden feedback");
        }
        feedback.restore();
        Feedback saved = feedbackRepository.save(feedback);
        exportService.refreshFeedback();
        auditLog.record(6, "RESTORE", actor, "Feedback #" + id + " restored (visible again)");
        return saved;
    }

    // ---------------- DELETE ----------------

    /** Administrators may remove test feedback; the action is always logged. */
    @Transactional
    public String delete(Long id, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Only an administrator can delete feedback");
        }
        Feedback feedback = getRequired(id);
        String summary = "#" + id + " (" + feedback.getPatient().getFullName() + ", rating "
                + feedback.getRating() + "/5)";
        feedbackRepository.delete(feedback);
        exportService.refreshFeedback();
        exportService.refreshSummary();
        auditLog.record(6, "DELETE", actor, "Feedback " + summary + " deleted - permitted test data removal");
        return "Feedback " + summary + " deleted.";
    }
}
