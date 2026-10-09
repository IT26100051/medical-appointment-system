package com.medcare.appointmentmanagement;

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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Component 03 - Appointment Management (the waiting list).
 *
 * <p>When no suitable time is free, a patient joins the waiting list of a
 * doctor. The clinic offers the first time that becomes free, and the entry is
 * closed once the patient has booked it (or leaves the list).</p>
 *
 * <p><b>Encapsulation.</b> The lifecycle of an entry is decided here and
 * nowhere else: {@link #offer(Long, String)} is the only way to offer a time,
 * {@link #markBooked()} the only way to close it as booked, and
 * {@link #cancel()} the only way to close it without a visit. A caller cannot
 * put an entry into a state the clinic does not allow.</p>
 */
@Entity
@Table(name = "waitlist_entry")
public class WaitlistEntry {

    /** Where an entry is in its life. */
    public enum Status {
        WAITING("Waiting"),
        OFFERED("A time offered"),
        BOOKED("Booked"),
        CANCELLED("Left the list");

        private final String label;

        Status(String label) {
            this.label = label;
        }

        public String getLabel() {
            return label;
        }

        /** Still holding a place on the list. */
        public boolean isOpen() {
            return this == WAITING || this == OFFERED;
        }
    }

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final DateTimeFormatter STAMP_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    /** The earliest day the patient can come. */
    @Column(name = "preferred_from", nullable = false)
    private LocalDate preferredFrom;

    /** The latest day the patient can come (may be empty - "any time after"). */
    @Column(name = "preferred_to")
    private LocalDate preferredTo;

    /** Anything the clinic should know ("mornings only", "needs a wheelchair ramp"). */
    @Column(length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.WAITING;

    /** The free time the clinic offered, kept so the offer can be shown again. */
    @Column(name = "offered_slot_id")
    private Long offeredSlotId;

    @Column(name = "offered_time", length = 60)
    private String offeredTime;

    @Column(name = "offered_at")
    private LocalDateTime offeredAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    protected WaitlistEntry() {
    }

    public WaitlistEntry(Patient patient, Doctor doctor, LocalDate preferredFrom,
                         LocalDate preferredTo, String note) {
        if (patient == null || doctor == null) {
            throw new IllegalArgumentException("A waiting-list entry needs a patient and a doctor");
        }
        if (preferredFrom == null) {
            throw new IllegalArgumentException("Please say from which day you can come");
        }
        if (preferredTo != null && preferredTo.isBefore(preferredFrom)) {
            throw new IllegalArgumentException("The last day cannot be before the first day");
        }
        this.patient = patient;
        this.doctor = doctor;
        this.preferredFrom = preferredFrom;
        this.preferredTo = preferredTo;
        this.note = note == null || note.isBlank() ? null : note.trim();
        this.status = Status.WAITING;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    /** Offers a specific free time to this patient. */
    public void offer(Long slotId, String timeLabel) {
        if (!isOpen()) {
            throw new IllegalStateException("This place on the waiting list has already been closed");
        }
        this.offeredSlotId = slotId;
        this.offeredTime = timeLabel;
        this.offeredAt = LocalDateTime.now();
        this.status = Status.OFFERED;
        touch();
    }

    /** The patient has booked the offered time. */
    /**
     * The offered time was taken by somebody else before this patient could
     * book it. The place returns to the queue - they keep their turn, and the
     * next free time will be offered to them again.
     */
    public void offerTaken() {
        if (status != Status.OFFERED) {
            return;
        }
        this.status = Status.WAITING;
        this.offeredSlotId = null;
        this.offeredTime = null;
        this.offeredAt = null;
        touch();
    }

    public void markBooked() {
        if (status == Status.CANCELLED || status == Status.BOOKED) {
            throw new IllegalStateException("This place on the waiting list is already closed");
        }
        this.status = Status.BOOKED;
        this.resolvedAt = LocalDateTime.now();
        touch();
    }

    /** The patient no longer needs a place (or the clinic closes it). */
    public void cancel() {
        if (status == Status.BOOKED) {
            throw new IllegalStateException("This place was already used for a booking");
        }
        this.status = Status.CANCELLED;
        this.resolvedAt = LocalDateTime.now();
        touch();
    }

    private void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Does this day suit the patient's stated window? A patient who left the
     * window open (no dates at all) is happy with any day.
     */
    public boolean suits(LocalDate day) {
        if (day == null) {
            return false;
        }
        if (preferredFrom != null && day.isBefore(preferredFrom)) {
            return false;
        }
        return preferredTo == null || !day.isAfter(preferredTo);
    }

    /** How the waiting period reads on a page or in the text file. */
    public String getWindowLabel() {
        if (preferredTo == null) {
            return "From " + DATE_FMT.format(preferredFrom) + " onwards";
        }
        if (preferredTo.equals(preferredFrom)) {
            return DATE_FMT.format(preferredFrom) + " only";
        }
        return DATE_FMT.format(preferredFrom) + " to " + DATE_FMT.format(preferredTo);
    }

    public String getStatusLabel() {
        return status.getLabel();
    }

    public String getCreatedStamp() {
        return STAMP_FMT.format(createdAt);
    }

    public String getOfferedStamp() {
        return offeredAt == null ? null : STAMP_FMT.format(offeredAt);
    }

    public boolean isOpen() {
        return status.isOpen();
    }

    public Long getId() {
        return id;
    }

    public Patient getPatient() {
        return patient;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public LocalDate getPreferredFrom() {
        return preferredFrom;
    }

    public LocalDate getPreferredTo() {
        return preferredTo;
    }

    public String getNote() {
        return note;
    }

    public Status getStatus() {
        return status;
    }

    public Long getOfferedSlotId() {
        return offeredSlotId;
    }

    public String getOfferedTime() {
        return offeredTime;
    }

    public LocalDateTime getOfferedAt() {
        return offeredAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
