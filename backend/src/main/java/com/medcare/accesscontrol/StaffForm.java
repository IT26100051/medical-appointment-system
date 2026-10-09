package com.medcare.accesscontrol;

import com.medcare.accesscontrol.Staff;
import com.medcare.common.domain.UserRole;
import com.medcare.common.form.UserForm;
import jakarta.validation.constraints.NotNull;

/**
 * Component 04 - Staff Management (form). Also extends {@link UserForm}.
 */
public class StaffForm extends UserForm {

    @NotNull(message = "Role is required")
    private UserRole role = UserRole.RECEPTIONIST;

    private String designation;
    private String employeeCode;
    private String counterNo;

    /** The inherited account fields (including gender) are applied by the parent form. */
    public void applyTo(Staff staff) {
        super.applyTo(staff);
        staff.updateStaffDetails(designation, employeeCode, counterNo, role);
        if (active != null) {
            staff.applyActiveFlag(active);
        }
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public void setEmployeeCode(String employeeCode) {
        this.employeeCode = employeeCode;
    }

    public String getCounterNo() {
        return counterNo;
    }

    public void setCounterNo(String counterNo) {
        this.counterNo = counterNo;
    }
}
