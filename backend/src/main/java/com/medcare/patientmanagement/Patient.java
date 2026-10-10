package com.medcare.patientmanagement;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import java.time.LocalDate;
import java.time.Period;

/**
 * Component 01 - Patient Management.
 *
 * <p><b>Encapsulation.</b> All patient specific data (date of birth, gender,
 * address, emergency contact, blood group) is private. The setters below are
 * the controlled access points and they normalise / validate the values, so a
 * patient record can never be assembled from random, unchecked pieces.</p>
 *
 * <p><b>Inheritance.</b> A patient <i>is a</i> {@link User}: username, password,
 * contact details and active status are inherited from the parent class.</p>
 */
@Entity
@DiscriminatorValue("PATIENT")
public class Patient extends User {

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 60)
    private String nic;

    @Column(length = 200)
    private String address;

    @Column(length = 40)
    private String city;

    @Column(length = 5)
    private String bloodGroup;

    @Column(name = "emergency_contact_name", length = 120)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    @Column(name = "medical_notes", length = 500)
    private String medicalNotes;

    public Patient() {
        super(UserRole.PATIENT);
    }

    public Patient(String username, String passwordHash, String fullName, String email, String phone) {
        super(UserRole.PATIENT);
        setUsername(username);
        changePassword(passwordHash);
        updateAccountDetails(fullName, email, phone);
    }

    /** Guarded update of all patient profile fields (Update operation). */
    public void updateProfile(LocalDate dateOfBirth, String gender, String nic, String address,
                              String city, String bloodGroup, String emergencyContactName,
                              String emergencyContactPhone, String medicalNotes) {
        this.dateOfBirth = dateOfBirth;
        changeGender(gender);
        this.nic = normalise(nic);
        this.address = normalise(address);
        this.city = normalise(city);
        this.bloodGroup = normalise(bloodGroup);
        this.emergencyContactName = normalise(emergencyContactName);
        this.emergencyContactPhone = normalise(emergencyContactPhone);
        this.medicalNotes = normalise(medicalNotes);
        touch();
    }

    @Override
    public String getAccountType() {
        return "Patient";
    }

    @Override
    public String getProfileSummary() {
        StringBuilder sb = new StringBuilder("Patient");
        if (age() != null) {
            sb.append(" | age ").append(age());
        }
        if (getGender() != null) {
            sb.append(" | ").append(getGender());
        }
        if (bloodGroup != null) {
            sb.append(" | blood group ").append(bloodGroup);
        }
        if (city != null) {
            sb.append(" | ").append(city);
        }
        return sb.toString();
    }

    /** Derived value - keeps the age consistent with the stored date of birth. */
    public Integer age() {
        if (dateOfBirth == null) {
            return null;
        }
        return Period.between(dateOfBirth, LocalDate.now()).getYears();
    }

    public boolean hasEmergencyContact() {
        return emergencyContactName != null && emergencyContactPhone != null;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public String getNic() {
        return nic;
    }

    public String getAddress() {
        return address;
    }

    public String getCity() {
        return city;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    public String getEmergencyContactPhone() {
        return emergencyContactPhone;
    }

    public String getMedicalNotes() {
        return medicalNotes;
    }
}
