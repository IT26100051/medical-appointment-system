package com.medcare.accesscontrol;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p>Administrator / receptionist accounts. <b>Polymorphism:</b> the very same
 * account workflow (create, update, deactivate) is used for staff as for
 * patients and doctors - the concrete type decides what extra data is kept.</p>
 */
@Entity
@DiscriminatorValue("STAFF")
public class Staff extends User {

    @Column(length = 60)
    private String designation;

    @Column(name = "employee_code", length = 30)
    private String employeeCode;

    @Column(name = "counter_no", length = 20)
    private String counterNo;

    public Staff() {
        super(UserRole.RECEPTIONIST);
    }

    public Staff(String username, String passwordHash, String fullName, UserRole role) {
        super(role);
        setUsername(username);
        changePassword(passwordHash);
        updateAccountDetails(fullName, null, null);
    }

    public void updateStaffDetails(String designation, String employeeCode, String counterNo, UserRole role) {
        this.designation = normalise(designation);
        this.employeeCode = normalise(employeeCode);
        this.counterNo = normalise(counterNo);
        if (role == UserRole.ADMIN || role == UserRole.RECEPTIONIST) {
            setRole(role);
        }
        touch();
    }

    @Override
    public String getAccountType() {
        return getRole() == UserRole.ADMIN ? "Administrator" : "Receptionist";
    }

    @Override
    public String getProfileSummary() {
        StringBuilder sb = new StringBuilder(getAccountType());
        if (designation != null) {
            sb.append(" | ").append(designation);
        }
        if (employeeCode != null) {
            sb.append(" | code ").append(employeeCode);
        }
        if (counterNo != null) {
            sb.append(" | counter ").append(counterNo);
        }
        return sb.toString();
    }

    public String getDesignation() {
        return designation;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public String getCounterNo() {
        return counterNo;
    }
}
