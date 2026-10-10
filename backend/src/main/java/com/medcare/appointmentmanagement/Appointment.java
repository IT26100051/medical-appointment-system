package com.medcare.appointmentmanagement;

import com.medcare.availability.DoctorAvailability;
import com.medcare.doctormanagement.Doctor;
import com.medcare.patientmanagement.Patient;
import jakarta.persistence.Column;
import jakarta.persistence.PostLoad;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Component 03 - Appointment Management.
 *
 * <p><b>Encapsulation.</b> The appointment status is private and can only move
 * through the lifecycle methods {@link #confirm()}, {@link #complete()},
 * {@link #cancel(String, String)} and {@link #reschedule(...)}. Each method
 * checks the current status first, which is why an appointment can never jump
 * from CANCELLED to COMPLETED or be confirmed twice.</p>
 */
@Entity
@Table(name = "appointment")
public class Appointment {

    /** How soon the patient should be seen - shown as a coloured mark in the lists. */
    public enum Priority {
        NORMAL("Routine", "An ordinary appointment"),
        URGENT("Urgent", "Should be seen soon"),
        FOLLOW_UP("Follow-up", "Review of an earlier consultation");

        private final String label;
        private final String description;

        Priority(String label, String description) {
            this.label = label;
            this.description = description;
        }

        public String getLabel() {
            return label;
        }

        public String getDescription() {
            return description;
        }
    }

    public enum Status {
        PENDING("Pending", "Booked, waiting for confirmation"),
        CONFIRMED("Confirmed", "Confirmed by the clinic"),
        COMPLETED("Completed", "Consultation finished"),
        CANCELLED("Cancelled", "Cancelled - kept as history"),
        NO_SHOW("No Show", "Patient did not attend");

        private final String label;
        private final String description;

        Status(String label, String description) {
            this.label = label;
            this.description = description;
        }

        public String getLabel() {
            return label;
        }

        public String getDescription() {
            return description;
        }

        public boolean isOpen() {
            return this == PENDING || this == CONFIRMED;
        }

        public boolean isFinished() {
            return this == COMPLETED || this == CANCELLED || this == NO_SHOW;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reference_no", nullable = false, unique = true, length = 20)
    private String referenceNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id")
    private DoctorAvailability slot;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(length = 300)
    private String reason;

    @Column(length = 500)
    private String notes;

    @Column(name = "cancellation_reason", length = 300)
    private String cancellationReason;

    @Column(name = "cancelled_by", length = 60)
    private String cancelledBy;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Priority priority = Priority.NORMAL;

    /** What the doctor wrote down after the consultation (the visit summary). */
    @Column(name = "visit_summary", length = 1000)
    private String visitSummary;

    /** When the patient should come back, and why - offered by the doctor on completion. */
    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(name = "follow_up_notes", length = 300)
    private String followUpNotes;

    @Column(name = "created_by", length = 60)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Appointment() {
    }

    public Appointment(String referenceNo, Patient patient, Doctor doctor, DoctorAvailability slot,
                       LocalDate appointmentDate, LocalTime startTime, LocalTime endTime,
                       String reason, String createdBy) {
        this.referenceNo = referenceNo;
        this.patient = patient;
        this.doctor = doctor;
        this.slot = slot;
        this.appointmentDate = appointmentDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.reason = normalise(reason);
        this.createdBy = createdBy;
    }

    // ------------------------------------------------------------------
    //  Lifecycle operations - the only way the status may change
    // ------------------------------------------------------------------

    public void confirm(String actor) {
        requireStatus(Status.PENDING, "confirm");
        this.status = Status.CONFIRMED;
        this.updatedAt = LocalDateTime.now();
    }

    public void complete(String actor) {
        if (!(status == Status.CONFIRMED || status == Status.PENDING)) {
            throw new IllegalStateException("Only a confirmed or pending appointment can be completed");
        }
        this.status = Status.COMPLETED;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Finishes the consultation and writes down what happened, exactly the way
     * a real clinic does it: the doctor's note becomes the patient's visit
     * summary and, when a review is needed, the next visit is suggested at the
     * same time. The status change itself stays inside {@link #complete(String)}.
     */
    public void completeWithSummary(String summary, LocalDate followUp, String followUpNotes, String actor) {
        complete(actor);
        this.visitSummary = normalise(summary);
        this.followUpDate = followUp;
        this.followUpNotes = normalise(followUpNotes);
        this.updatedAt = LocalDateTime.now();
    }

    /** Records the visit summary without changing the status (corrections). */
    public void recordVisitSummary(String summary, LocalDate followUp, String followUpNotes) {
        if (status != Status.COMPLETED) {
            throw new IllegalStateException("A visit summary can only be written on a completed consultation");
        }
        this.visitSummary = normalise(summary);
        this.followUpDate = followUp;
        this.followUpNotes = normalise(followUpNotes);
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel(String reason, String actor) {
        if (status == Status.COMPLETED) {
            throw new IllegalStateException("A completed appointment cannot be cancelled");
        }
        if (status == Status.CANCELLED) {
            throw new IllegalStateException("This appointment is already cancelled");
        }
        this.status = Status.CANCELLED;
        this.cancellationReason = normalise(reason);
        this.cancelledBy = actor;
        this.updatedAt = LocalDateTime.now();
        releaseSlot();
    }

    public void markNoShow(String actor) {
        requireStatus(Status.CONFIRMED, "mark as no-show");
        this.status = Status.NO_SHOW;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Correction path: puts a completed appointment back to Confirmed so the
     * clinic can fix a mistake (wrong record completed, extra consultation
     * needed). Only a completed appointment can be reopened.
     */
    public void reopen(String actor) {
        requireStatus(Status.COMPLETED, "reopen");
        this.status = Status.CONFIRMED;
        this.updatedAt = LocalDateTime.now();
    }

    /** Moves the appointment onto another availability slot of the same doctor. */
    public void reschedule(DoctorAvailability newSlot, String actor) {
        if (!status.isOpen()) {
            throw new IllegalStateException("Only pending or confirmed appointments can be rescheduled");
        }
        if (newSlot == null || !newSlot.isAvailableForBooking()) {
            throw new IllegalArgumentException("The selected slot is not available");
        }
        if (this.slot != null) {
            this.slot.release();
        }
        this.slot = newSlot;
        this.doctor = newSlot.getDoctor();
        this.appointmentDate = newSlot.getSlotDate();
        this.startTime = newSlot.getStartTime();
        this.endTime = newSlot.getEndTime();
        newSlot.markBooked();
        this.updatedAt = LocalDateTime.now();
    }

    /** Called when the appointment is deleted - the slot becomes bookable again. */
    public void detachSlot() {
        releaseSlot();
    }

    private void releaseSlot() {
        if (slot != null && slot.getStatus() == DoctorAvailability.SlotStatus.BOOKED) {
            slot.release();
        }
    }

    private void requireStatus(Status expected, String action) {
        if (this.status != expected) {
            throw new IllegalStateException("Cannot " + action + " an appointment that is " + status.getLabel());
        }
    }

    // ------------------------------------------------------------------
    //  Read access
    // ------------------------------------------------------------------

    public boolean belongsTo(Long userId) {
        return userId != null && patient != null && userId.equals(patient.getId());
    }

    public boolean isScheduledWith(Long doctorId) {
        return doctorId != null && doctor != null && doctorId.equals(doctor.getId());
    }

    public LocalDateTime getStartDateTime() {
        return LocalDateTime.of(appointmentDate, startTime);
    }

    public boolean isInFuture() {
        return getStartDateTime().isAfter(LocalDateTime.now());
    }

    /** How many days from now the visit takes place (negative when it is in the past). */
    public long daysAway() {
        return java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), appointmentDate);
    }

    /**
     * A record that was saved before the clinic started recording visit types
     * has no value in that column; it simply counts as a routine visit, so no
     * page ever has to check for a missing priority.
     */
    public Priority getPriority() {
        return priority == null ? Priority.NORMAL : priority;
    }

    /** Also tidies records that were stored before this field existed. */
    @PostLoad
    private void applyDefaults() {
        if (priority == null) {
            priority = Priority.NORMAL;
        }
    }

    /** A follow-up visit is treated as urgent by default, which is how clinics triage them. */
    public void changePriority(Priority priority) {
        this.priority = priority == null ? Priority.NORMAL : priority;
        this.updatedAt = LocalDateTime.now();
    }

    public String getVisitSummary() {
        return visitSummary;
    }

    public LocalDate getFollowUpDate() {
        return followUpDate;
    }

    public String getFollowUpNotes() {
        return followUpNotes;
    }

    public void changeReason(String reason) {
        this.reason = normalise(reason);
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getReferenceNo() {
        return referenceNo;
    }

    public Patient getPatient() {
        return patient;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public DoctorAvailability getSlot() {
        return slot;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public Status getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = normalise(reason);
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = normalise(notes);
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public String getCancelledBy() {
        return cancelledBy;
    }

    public String getCreatedBy() {
        return createdBy;
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
