package com.medcare.availability;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.doctormanagement.Doctor;
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
import java.time.LocalTime;

/**
 * Component 05 - Doctor Availability and Schedule Management.
 *
 * <p><b>Encapsulation.</b> The slot keeps its own data <i>and</i> its status
 * together: only {@link #block()}, {@link #unblock()}, {@link #markBooked()},
 * {@link #release()} and {@link #changeTime(LocalTime, LocalTime)} may change
 * the state, and each of them refuses illegal transitions (a booked slot can
 * never be blocked or deleted, only rescheduled through Appointment
 * Management).</p>
 */
@Entity
@Table(name = "doctor_availability")
public class DoctorAvailability {

    public enum SlotStatus {
        AVAILABLE("Available", "Open for booking"),
        BLOCKED("Blocked", "Temporarily withheld by the doctor/clinic"),
        BOOKED("Booked", "Reserved by an appointment");

        private final String label;
        private final String description;

        SlotStatus(String label, String description) {
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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(name = "slot_date", nullable = false)
    private LocalDate slotDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SlotStatus status = SlotStatus.AVAILABLE;

    @Column(length = 200)
    private String remarks;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public DoctorAvailability() {
    }

    public DoctorAvailability(Doctor doctor, LocalDate slotDate, LocalTime startTime, LocalTime endTime) {
        if (doctor == null) {
            throw new IllegalArgumentException("A slot must belong to a doctor");
        }
        if (slotDate == null || startTime == null || endTime == null) {
            throw new IllegalArgumentException("Date, start time and end time are required");
        }
        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("End time must be after the start time");
        }
        this.doctor = doctor;
        this.slotDate = slotDate;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    // ------------------------------------------------------------------
    //  Guarded state changes
    // ------------------------------------------------------------------

    public void block(String remarks) {
        if (status == SlotStatus.BOOKED) {
            throw new IllegalStateException("A booked slot cannot be blocked - reschedule the appointment first");
        }
        this.status = SlotStatus.BLOCKED;
        this.remarks = remarks == null || remarks.isBlank() ? "Blocked" : remarks.trim();
        touch();
    }

    public void unblock() {
        if (status == SlotStatus.BOOKED) {
            throw new IllegalStateException("A booked slot cannot be unblocked");
        }
        this.status = SlotStatus.AVAILABLE;
        this.remarks = null;
        touch();
    }

    public void markBooked() {
        if (status != SlotStatus.AVAILABLE) {
            throw new IllegalStateException("Only an available slot can be booked");
        }
        this.status = SlotStatus.BOOKED;
        touch();
    }

    /** Frees the slot again (appointment cancelled or rescheduled away). */
    public void release() {
        this.status = SlotStatus.AVAILABLE;
        this.remarks = null;
        touch();
    }

    /** Change the time of an unused slot when the new time is valid. */
    public void changeTime(LocalTime newStart, LocalTime newEnd) {
        if (status == SlotStatus.BOOKED) {
            throw new IllegalStateException("Time of a booked slot cannot be changed directly");
        }
        if (newStart == null || newEnd == null || !newEnd.isAfter(newStart)) {
            throw new IllegalArgumentException("End time must be after the start time");
        }
        this.startTime = newStart;
        this.endTime = newEnd;
        touch();
    }

    // ------------------------------------------------------------------
    //  Read access
    // ------------------------------------------------------------------

    public boolean isAvailableForBooking() {
        return status == SlotStatus.AVAILABLE;
    }

    public boolean isDeleteAllowed() {
        return status != SlotStatus.BOOKED;
    }

    public boolean overlaps(LocalDate date, LocalTime start, LocalTime end) {
        return slotDate.equals(date) && start.isBefore(endTime) && end.isAfter(startTime);
    }

    public String getStatusLabel() {
        return status.getLabel();
    }

    private void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public LocalDate getSlotDate() {
        return slotDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public SlotStatus getStatus() {
        return status;
    }

    public String getRemarks() {
        return remarks;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
