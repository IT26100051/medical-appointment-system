package com.medcare.appointmentmanagement;

import jakarta.validation.constraints.NotNull;

/** Component 03 - Appointment Management (booking / reschedule form). */
public class AppointmentForm {

    /** Required unless a brand new patient is being registered at the same time. */
    private Long patientId;

    @NotNull(message = "Please select a doctor")
    private Long doctorId;

    @NotNull(message = "Please select an available slot")
    private Long slotId;

    private String reason;

    /** Routine, urgent or follow-up - shown as a coloured mark in the appointment lists. */
    private String priority;

    /**
     * Walk-in registration. A patient who has never been to the clinic can be
     * written into the register while the appointment is being booked, so the
     * receptionist does not have to leave the booking page. The name and the
     * telephone number are enough to open a record.
     */
    private String newPatientName;
    private String newPatientPhone;
    private String newPatientGender;
    private String newPatientCity;

    /** Used by the reschedule dialog. */
    private Long newSlotId;

    private String cancellationReason;

    public Long getPatientId() {
        return patientId;
    }

    public void setPatientId(Long patientId) {
        this.patientId = patientId;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    public Long getSlotId() {
        return slotId;
    }

    public void setSlotId(Long slotId) {
        this.slotId = slotId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public boolean isNewPatient() {
        return (patientId == null) && newPatientName != null && !newPatientName.isBlank();
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getNewPatientName() {
        return newPatientName;
    }

    public void setNewPatientName(String newPatientName) {
        this.newPatientName = newPatientName;
    }

    public String getNewPatientPhone() {
        return newPatientPhone;
    }

    public void setNewPatientPhone(String newPatientPhone) {
        this.newPatientPhone = newPatientPhone;
    }

    public String getNewPatientGender() {
        return newPatientGender;
    }

    public void setNewPatientGender(String newPatientGender) {
        this.newPatientGender = newPatientGender;
    }

    public String getNewPatientCity() {
        return newPatientCity;
    }

    public void setNewPatientCity(String newPatientCity) {
        this.newPatientCity = newPatientCity;
    }

    public Long getNewSlotId() {
        return newSlotId;
    }

    public void setNewSlotId(Long newSlotId) {
        this.newSlotId = newSlotId;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void setCancellationReason(String cancellationReason) {
        this.cancellationReason = cancellationReason;
    }
}
