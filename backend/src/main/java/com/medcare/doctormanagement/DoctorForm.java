package com.medcare.doctormanagement;

import com.medcare.common.form.UserForm;
import com.medcare.doctormanagement.Doctor;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Component 02 - Doctor Management (form).
 *
 * <p><b>Inheritance.</b> {@code DoctorForm extends UserForm}: the login and
 * contact fields come from the parent, only the professional fields are added.
 * <b>Polymorphism</b> lets shared service code accept a {@code UserForm} and
 * still store the doctor specific columns of this subclass.</p>
 */
public class DoctorForm extends UserForm {

    @NotBlank(message = "Specialization is required")
    private String specialization;

    private String qualifications;
    private String registrationNo;

    @Min(value = 5, message = "Consultation duration must be at least 5 minutes")
    @Max(value = 120, message = "Consultation duration cannot exceed 120 minutes")
    private Integer consultationMinutes = 30;

    private Double consultationFee;
    private String roomNo;

    /** The inherited account fields (including gender) are applied by the parent form. */
    public void applyTo(Doctor doctor) {
        super.applyTo(doctor);
        doctor.updateProfessionalDetails(specialization, qualifications, registrationNo,
                consultationMinutes, consultationFee, roomNo);
        if (active != null) {
            doctor.applyActiveFlag(active);
        }
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public String getQualifications() {
        return qualifications;
    }

    public void setQualifications(String qualifications) {
        this.qualifications = qualifications;
    }

    public String getRegistrationNo() {
        return registrationNo;
    }

    public void setRegistrationNo(String registrationNo) {
        this.registrationNo = registrationNo;
    }

    public Integer getConsultationMinutes() {
        return consultationMinutes;
    }

    public void setConsultationMinutes(Integer consultationMinutes) {
        this.consultationMinutes = consultationMinutes;
    }

    public Double getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(Double consultationFee) {
        this.consultationFee = consultationFee;
    }

    public String getRoomNo() {
        return roomNo;
    }

    public void setRoomNo(String roomNo) {
        this.roomNo = roomNo;
    }
}
