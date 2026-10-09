package com.medcare.appointmentmanagement;

import java.time.LocalDate;

/** What the waiting-list page sends (Component 03 - Appointment Management). */
public class WaitlistForm {

    private Long doctorId;
    private Long patientId;
    private LocalDate preferredFrom;
    private LocalDate preferredTo;
    private String note;

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    /** Only used when the clinic adds somebody over the telephone. */
    public Long getPatientId() {
        return patientId;
    }

    public void setPatientId(Long patientId) {
        this.patientId = patientId;
    }

    public LocalDate getPreferredFrom() {
        return preferredFrom;
    }

    public void setPreferredFrom(LocalDate preferredFrom) {
        this.preferredFrom = preferredFrom;
    }

    public LocalDate getPreferredTo() {
        return preferredTo;
    }

    public void setPreferredTo(LocalDate preferredTo) {
        this.preferredTo = preferredTo;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
