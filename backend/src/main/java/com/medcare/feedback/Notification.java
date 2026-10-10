package com.medcare.feedback;

import com.medcare.appointmentmanagement.Appointment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Component 06 - Feedback and Notification Management.
 *
 * <p><b>Encapsulation.</b> Read/unread state is private; {@link #markAsRead()}
 * and {@link #markAsUnread()} are the only transitions. The recipient is stored
 * as an id so a notification can be delivered without loading the whole user
 * object.</p>
 */
@Entity
@Table(name = "notification")
public class Notification {

    public enum Type {
        BOOKING_CREATED("New booking"),
        BOOKING_CONFIRMED("Booking confirmed"),
        BOOKING_CANCELLED("Booking cancelled"),
        BOOKING_RESCHEDULED("Booking rescheduled"),
        APPOINTMENT_COMPLETED("Consultation completed"),
        FEEDBACK_RECEIVED("New feedback"),
        ACCOUNT_UPDATE("Account update"),
        REMINDER("Appointment reminder"),
        WAITING_LIST("Waiting list");

        private final String label;

        Type(String label) {
            this.label = label;
        }

        public String getLabel() {
            return label;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    @Column(name = "recipient_role", length = 20)
    private String recipientRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Type type;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 500)
    private String message;

    @Column(name = "related_appointment_id")
    private Long relatedAppointmentId;

    @Column(name = "read_flag", nullable = false)
    private boolean readFlag;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification() {
    }

    public Notification(Long recipientId, String recipientRole, Type type, String title,
                        String message, Long relatedAppointmentId) {
        this.recipientId = recipientId;
        this.recipientRole = recipientRole;
        this.type = type;
        this.title = title;
        this.message = message;
        this.relatedAppointmentId = relatedAppointmentId;
        this.readFlag = false;
        this.createdAt = LocalDateTime.now();
    }

    public void markAsRead() {
        this.readFlag = true;
    }

    public void markAsUnread() {
        this.readFlag = false;
    }

    public boolean isOwnedBy(Long userId) {
        return userId != null && userId.equals(recipientId);
    }

    public Long getId() {
        return id;
    }

    public Long getRecipientId() {
        return recipientId;
    }

    public String getRecipientRole() {
        return recipientRole;
    }

    public Type getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public Long getRelatedAppointmentId() {
        return relatedAppointmentId;
    }

    public boolean isRead() {
        return readFlag;
    }

    public boolean isReadFlag() {
        return readFlag;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
