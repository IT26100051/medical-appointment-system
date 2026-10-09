package com.medcare.patientmanagement;

import com.medcare.common.form.UserForm;
import com.medcare.patientmanagement.Patient;
import java.time.LocalDate;

/**
 * Component 01 - Patient Management (form).
 *
 * <p><b>Inheritance.</b> {@code PatientForm extends UserForm} - the account
 * fields (name, username, password, e-mail, phone, active status) are inherited
 * and only the patient specific fields are added here.</p>
 */
public class PatientForm extends UserForm {

    private LocalDate dateOfBirth;
    private String nic;
    private String address;
    private String city;
    private String bloodGroup;
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String medicalNotes;

    /** Applies the inherited account part and the patient part to an entity. */
    public void applyTo(Patient patient) {
        super.applyTo(patient);   // reuse the shared account handling
        patient.updateProfile(dateOfBirth, gender, nic, address, city, bloodGroup,
                emergencyContactName, emergencyContactPhone, medicalNotes);
        if (active != null) {
            patient.applyActiveFlag(active);
        }
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getNic() {
        return nic;
    }

    public void setNic(String nic) {
        this.nic = nic;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public void setBloodGroup(String bloodGroup) {
        this.bloodGroup = bloodGroup;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    public void setEmergencyContactName(String emergencyContactName) {
        this.emergencyContactName = emergencyContactName;
    }

    public String getEmergencyContactPhone() {
        return emergencyContactPhone;
    }

    public void setEmergencyContactPhone(String emergencyContactPhone) {
        this.emergencyContactPhone = emergencyContactPhone;
    }

    public String getMedicalNotes() {
        return medicalNotes;
    }

    public void setMedicalNotes(String medicalNotes) {
        this.medicalNotes = medicalNotes;
    }
}
