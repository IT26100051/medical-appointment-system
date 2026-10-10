package com.medcare.doctormanagement;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

/**
 * Component 02 - Doctor Management.
 *
 * <p><b>Encapsulation.</b> Professional attributes (specialization,
 * qualifications, consultation duration, fee, room) are private and only
 * changeable through {@link #updateProfessionalDetails}. The consultation
 * duration is validated here so no caller can store a nonsensical value.</p>
 *
 * <p><b>Inheritance.</b> A doctor <i>is a</i> {@link User} - the login and
 * contact information is reused from the parent class instead of being
 * duplicated.</p>
 */
@Entity
@DiscriminatorValue("DOCTOR")
public class Doctor extends User {

    public static final int MIN_CONSULTATION_MINUTES = 5;
    public static final int MAX_CONSULTATION_MINUTES = 120;

    @Column(length = 80)
    private String specialization;

    @Column(length = 200)
    private String qualifications;

    @Column(name = "registration_no", length = 40)
    private String registrationNo;

    @Column(name = "consultation_minutes")
    private Integer consultationMinutes = 30;

    @Column(name = "consultation_fee")
    private Double consultationFee;

    @Column(name = "room_no", length = 20)
    private String roomNo;

    public Doctor() {
        super(UserRole.DOCTOR);
    }

    public Doctor(String username, String passwordHash, String fullName, String specialization) {
        super(UserRole.DOCTOR);
        setUsername(username);
        changePassword(passwordHash);
        updateAccountDetails(fullName, null, null);
        this.specialization = specialization;
    }

    /**
     * Guarded update of the professional details (Update operation).
     *
     * @throws IllegalArgumentException when the consultation duration is outside
     *                                  the allowed range.
     */
    public void updateProfessionalDetails(String specialization, String qualifications,
                                          String registrationNo, Integer consultationMinutes,
                                          Double consultationFee, String roomNo) {
        if (consultationMinutes == null
                || consultationMinutes < MIN_CONSULTATION_MINUTES
                || consultationMinutes > MAX_CONSULTATION_MINUTES) {
            throw new IllegalArgumentException("Consultation duration must be between "
                    + MIN_CONSULTATION_MINUTES + " and " + MAX_CONSULTATION_MINUTES + " minutes");
        }
        this.specialization = normalise(specialization);
        this.qualifications = normalise(qualifications);
        this.registrationNo = normalise(registrationNo);
        this.consultationMinutes = consultationMinutes;
        this.consultationFee = consultationFee;
        this.roomNo = normalise(roomNo);
        touch();
    }

    @Override
    public String getAccountType() {
        return "Doctor";
    }

    @Override
    public String getProfileSummary() {
        StringBuilder sb = new StringBuilder("Doctor");
        if (specialization != null) {
            sb.append(" | ").append(specialization);
        }
        sb.append(" | ").append(consultationMinutes).append(" min consultation");
        if (consultationFee != null) {
            sb.append(String.format(" | fee %.2f", consultationFee));
        }
        return sb.toString();
    }

    public String getSpecialization() {
        return specialization;
    }

    public String getQualifications() {
        return qualifications;
    }

    public String getRegistrationNo() {
        return registrationNo;
    }

    public Integer getConsultationMinutes() {
        return consultationMinutes;
    }

    public Double getConsultationFee() {
        return consultationFee;
    }

    public String getRoomNo() {
        return roomNo;
    }
}
