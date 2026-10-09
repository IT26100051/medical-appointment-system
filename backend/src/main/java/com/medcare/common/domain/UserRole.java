package com.medcare.common.domain;

import com.medcare.accesscontrol.Staff;
import com.medcare.doctormanagement.Doctor;
import com.medcare.patientmanagement.Patient;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p>The single list of roles used by the whole system. Presentation code never
 * decides "who may do what" by itself - it asks the role (or the security
 * interceptor) instead, which keeps access decisions out of the UI layer.</p>
 */
public enum UserRole {

    ADMIN("Administrator", "Full system access, staff management, moderation"),
    RECEPTIONIST("Receptionist", "Front-desk: patients, appointments and schedules"),
    DOCTOR("Doctor", "Own schedule, own appointments and patient feedback"),
    PATIENT("Patient", "Own profile, own appointments, feedback and notifications");

    private final String displayName;
    private final String description;

    UserRole(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public boolean isStaff() {
        return this == ADMIN || this == RECEPTIONIST;
    }

    /** Patients and doctors may only ever see their own records. */
    public boolean isCareParticipant() {
        return this == PATIENT || this == DOCTOR;
    }
}
