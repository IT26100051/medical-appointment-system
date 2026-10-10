package com.medcare.feedback;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.documents.TextFileService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.feedback.Notification;
import com.medcare.feedback.NotificationRepository;
import com.medcare.patientmanagement.Patient;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 06 - Notification Management.
 *
 * <p><b>Abstraction.</b> Controllers never build a notification themselves, they
 * call one of the semantic methods below ({@code appointmentBooked},
 * {@code appointmentCancelled}, ...). The message wording, the recipient rules
 * and the file export all live in this single service.</p>
 *
 * <p><b>Polymorphism.</b> {@link #deliver} takes a {@link Notification.Type} and
 * each public method maps an appointment event onto the matching type, so new
 * event types only need one extra method here.</p>
 */
@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final TextFileService textFileService;
    private final DataExportService exportService;

    public NotificationService(NotificationRepository notificationRepository,
                               TextFileService textFileService,
                               DataExportService exportService) {
        this.notificationRepository = notificationRepository;
        this.textFileService = textFileService;
        this.exportService = exportService;
    }

    // ==================================================================
    //  Delivery - one entry point, different messages per event type
    // ==================================================================

    @Transactional
    public Notification deliver(User recipient, Notification.Type type, String title, String message,
                                Long appointmentId) {
        if (recipient == null) {
            return null;
        }
        Notification notification = new Notification(recipient.getId(), recipient.getRole().name(),
                type, title, message, appointmentId);
        Notification saved = notificationRepository.save(notification);
        exportService.refreshNotifications();
        return saved;
    }

    @Transactional
    public void notifyAccountChange(User recipient, String title, String message) {
        deliver(recipient, Notification.Type.ACCOUNT_UPDATE, title, message, null);
    }

    @Transactional
    public void appointmentBooked(Appointment appointment, User actor) {
        deliver(appointment.getPatient(), Notification.Type.BOOKING_CREATED,
                "Appointment booked - " + appointment.getReferenceNo(),
                "Your appointment with Dr. " + appointment.getDoctor().getFullName() + " on "
                        + appointment.getAppointmentDate() + " at " + appointment.getStartTime()
                        + " has been registered. Status: " + appointment.getStatus().getLabel() + ".",
                appointment.getId());
        deliver(appointment.getDoctor(), Notification.Type.BOOKING_CREATED,
                "New appointment - " + appointment.getReferenceNo(),
                "Patient " + appointment.getPatient().getFullName() + " booked "
                        + appointment.getAppointmentDate() + " at " + appointment.getStartTime()
                        + " (" + appointment.getReason() + ").",
                appointment.getId());
    }

    @Transactional
    public void appointmentConfirmed(Appointment appointment) {
        deliver(appointment.getPatient(), Notification.Type.BOOKING_CONFIRMED,
                "Appointment confirmed - " + appointment.getReferenceNo(),
                "Dr. " + appointment.getDoctor().getFullName() + " confirmed your appointment on "
                        + appointment.getAppointmentDate() + " at " + appointment.getStartTime() + ".",
                appointment.getId());
    }

    @Transactional
    public void appointmentRescheduled(Appointment appointment) {
        deliver(appointment.getPatient(), Notification.Type.BOOKING_RESCHEDULED,
                "Appointment rescheduled - " + appointment.getReferenceNo(),
                "Your appointment has been moved to " + appointment.getAppointmentDate() + " at "
                        + appointment.getStartTime() + " with Dr. " + appointment.getDoctor().getFullName() + ".",
                appointment.getId());
        deliver(appointment.getDoctor(), Notification.Type.BOOKING_RESCHEDULED,
                "Appointment rescheduled - " + appointment.getReferenceNo(),
                "Patient " + appointment.getPatient().getFullName() + " moved to "
                        + appointment.getAppointmentDate() + " at " + appointment.getStartTime() + ".",
                appointment.getId());
    }

    @Transactional
    public void appointmentCancelled(Appointment appointment, String cancelledByLabel) {
        deliver(appointment.getPatient(), Notification.Type.BOOKING_CANCELLED,
                "Appointment cancelled - " + appointment.getReferenceNo(),
                "The appointment on " + appointment.getAppointmentDate() + " at " + appointment.getStartTime()
                        + " was cancelled by " + cancelledByLabel + ". Reason: "
                        + (appointment.getCancellationReason() == null ? "not stated" : appointment.getCancellationReason()),
                appointment.getId());
        deliver(appointment.getDoctor(), Notification.Type.BOOKING_CANCELLED,
                "Appointment cancelled - " + appointment.getReferenceNo(),
                "Patient " + appointment.getPatient().getFullName() + "'s appointment on "
                        + appointment.getAppointmentDate() + " at " + appointment.getStartTime()
                        + " was cancelled. The slot is available again.",
                appointment.getId());
    }

    @Transactional
    public void appointmentCompleted(Appointment appointment) {
        deliver(appointment.getPatient(), Notification.Type.APPOINTMENT_COMPLETED,
                "Consultation completed - " + appointment.getReferenceNo(),
                "We hope your visit with Dr. " + appointment.getDoctor().getFullName()
                        + " went well. You can now submit feedback for this consultation.",
                appointment.getId());
    }

    @Transactional
    public void appointmentReopened(Appointment appointment) {
        deliver(appointment.getPatient(), Notification.Type.BOOKING_CONFIRMED,
                "Appointment reopened - " + appointment.getReferenceNo(),
                "The clinic reopened your consultation record on " + appointment.getAppointmentDate()
                        + " at " + appointment.getStartTime() + ". Please check the details in your appointment list.",
                appointment.getId());
    }

    @Transactional
    public void feedbackReceived(com.medcare.feedback.Feedback feedback) {
        deliver(feedback.getDoctor(), Notification.Type.FEEDBACK_RECEIVED,
                "New feedback received",
                "Patient " + feedback.getPatient().getFullName() + " rated your consultation "
                        + feedback.getRating() + "/5.",
                feedback.getAppointment() == null ? null : feedback.getAppointment().getId());
    }

    // ==================================================================
    //  Inbox operations
    // ==================================================================

    @Transactional(readOnly = true)
    public List<Notification> inbox(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<Notification> unread(Long userId) {
        return notificationRepository.findByRecipientIdAndReadFlagFalseOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndReadFlagFalse(userId);
    }

    @Transactional(readOnly = true)
    public List<Notification> all() {
        return notificationRepository.findAll();
    }

    @Transactional
    public Notification markRead(Long notificationId, Long userId) {
        Notification notification = getOwned(notificationId, userId);
        notification.markAsRead();
        Notification saved = notificationRepository.save(notification);
        exportService.refreshNotifications();
        return saved;
    }

    @Transactional
    public Notification markUnread(Long notificationId, Long userId) {
        Notification notification = getOwned(notificationId, userId);
        notification.markAsUnread();
        Notification saved = notificationRepository.save(notification);
        exportService.refreshNotifications();
        return saved;
    }

    @Transactional
    public int markAllRead(Long userId) {
        List<Notification> unread = notificationRepository
                .findByRecipientIdAndReadFlagFalseOrderByCreatedAtDesc(userId);
        unread.forEach(Notification::markAsRead);
        notificationRepository.saveAll(unread);
        exportService.refreshNotifications();
        return unread.size();
    }

    /** Only read notifications may be cleared - unread ones still need attention. */
    @Transactional
    public String delete(Long notificationId, User actor) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> ResourceNotFoundException.of("Notification", notificationId));
        boolean owner = notification.isOwnedBy(actor.getId());
        boolean admin = actor.getRole() == com.medcare.common.domain.UserRole.ADMIN;
        if (!owner && !admin) {
            throw new AccessDeniedException("You can only manage your own notifications");
        }
        if (!notification.isRead() && !admin) {
            throw new IllegalStateException("Mark the notification as read before deleting it");
        }
        notificationRepository.delete(notification);
        exportService.refreshNotifications();
        return "Notification removed from the inbox.";
    }

    private Notification getOwned(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> ResourceNotFoundException.of("Notification", notificationId));
        if (!notification.isOwnedBy(userId)) {
            throw new AccessDeniedException("This notification does not belong to you");
        }
        return notification;
    }
}
