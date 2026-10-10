package com.medcare.feedback;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.doctormanagement.Doctor;
import com.medcare.patientmanagement.Patient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Component 06 - Feedback and Notification Management.
 *
 * <p><b>Encapsulation.</b> A feedback entry controls its own lifecycle:
 * {@link #edit(Integer, String)} for the author, {@link #hide(String)} and
 * {@link #restore()} for the moderator. Rating bounds and the moderation flag
 * are enforced inside the entity.</p>
 */
@Entity
@Table(name = "feedback")
public class Feedback {

    public enum Moderation {
        VISIBLE("Visible"),
        HIDDEN("Hidden");

        private final String label;

        Moderation(String label) {
            this.label = label;
        }

        public String getLabel() {
            return label;
        }
    }

    public static final int MIN_RATING = 1;
    public static final int MAX_RATING = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appointment_id", nullable = false)
    private Appointment appointment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(nullable = false)
    private Integer rating;

    @Column(length = 1000)
    private String comments;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Moderation moderation = Moderation.VISIBLE;

    @Column(name = "moderation_note", length = 300)
    private String moderationNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Feedback() {
    }

    public Feedback(Appointment appointment, Integer rating, String comments) {
        if (appointment == null || appointment.getStatus() != Appointment.Status.COMPLETED) {
            throw new IllegalStateException("Feedback can only be given for a completed appointment");
        }
        validateRating(rating);
        this.appointment = appointment;
        this.patient = appointment.getPatient();
        this.doctor = appointment.getDoctor();
        this.rating = rating;
        this.comments = normalise(comments);
    }

    public void edit(Integer newRating, String newComments) {
        validateRating(newRating);
        this.rating = newRating;
        this.comments = normalise(newComments);
        touch();
    }

    public void hide(String note) {
        this.moderation = Moderation.HIDDEN;
        this.moderationNote = normalise(note);
        touch();
    }

    public void restore() {
        this.moderation = Moderation.VISIBLE;
        this.moderationNote = null;
        touch();
    }

    public boolean isModeratedBy(Long userId) {
        return userId != null && doctor != null && userId.equals(doctor.getId());
    }

    private void validateRating(Integer value) {
        if (value == null || value < MIN_RATING || value > MAX_RATING) {
            throw new IllegalArgumentException("Rating must be between " + MIN_RATING + " and " + MAX_RATING);
        }
    }

    private void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isVisible() {
        return moderation == Moderation.VISIBLE;
    }

    public Long getId() {
        return id;
    }

    public Appointment getAppointment() {
        return appointment;
    }

    public Patient getPatient() {
        return patient;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public Integer getRating() {
        return rating;
    }

    public String getComments() {
        return comments;
    }

    public Moderation getModeration() {
        return moderation;
    }

    public String getModerationNote() {
        return moderationNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    private static String normalise(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
