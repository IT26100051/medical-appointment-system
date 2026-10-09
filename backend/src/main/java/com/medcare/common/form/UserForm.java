package com.medcare.common.form;

import com.medcare.accesscontrol.Staff;
import com.medcare.accesscontrol.StaffForm;
import com.medcare.common.domain.User;
import com.medcare.doctormanagement.DoctorForm;
import com.medcare.patientmanagement.PatientForm;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Component 04 - Access Control and Staff Management (shared form base class).
 *
 * <p><b>Inheritance &amp; polymorphism.</b> This class holds the account fields
 * that every user type shares. {@link PatientForm}, {@link DoctorForm} and
 * {@link StaffForm} extend it, so one validation routine and one
 * {@link #applyTo(User) applyTo} routine works for all account types through a
 * plain {@code UserForm} reference.</p>
 */
public class UserForm {

    @NotBlank(message = "Full name is required")
    @Size(max = 120, message = "Full name is too long")
    protected String fullName;

    @NotBlank(message = "Username is required")
    @Pattern(regexp = "^[A-Za-z0-9._-]{4,50}$",
            message = "Username must be 4-50 characters (letters, digits, . _ -)")
    protected String username;

    /** Only required for new accounts; optional when editing an existing one. */
    @Size(min = 6, max = 64, message = "Password must be at least 6 characters")
    protected String password;

    @Email(message = "Enter a valid e-mail address")
    @Size(max = 120, message = "E-mail is too long")
    protected String email;

    @Pattern(regexp = "^$|^[0-9+()\\-\\s]{7,20}$", message = "Enter a valid phone number")
    protected String phone;

    protected Boolean active = Boolean.TRUE;

    /** Optional; it decides which default profile picture is shown. */
    protected String gender;

    /** Copies the shared account fields onto any {@link User} subtype. */
    public void applyTo(User user) {
        if (username != null && !username.isBlank()) {
            user.assignUsername(username);
        }
        user.updateAccountDetails(fullName, email, phone);
        if (gender != null) {
            user.changeGender(gender);
        }
        user.changePhoto(photo);
    }

    /** True when the form carries a new password that should be applied. */
    private String photo;

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getPhoto() {
        return photo;
    }

    public void setPhoto(String photo) {
        this.photo = photo;
    }

    public boolean hasPassword() {
        return password != null && !password.isBlank();
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
