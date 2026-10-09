package com.medcare.common.security;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import java.io.Serializable;

/**
 * Component 04 - Access Control.
 *
 * <p>The logged-in principal kept in the HTTP session. Only the information the
 * presentation layer actually needs is exposed; the password hash and the rest
 * of the entity never leave the service layer.</p>
 */
public class SessionUser implements Serializable {

    private final Long id;
    private final String username;
    private final String fullName;
    private final UserRole role;

    public SessionUser(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.fullName = user.getFullName();
        this.role = user.getRole();
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getFullName() {
        return fullName;
    }

    public UserRole getRole() {
        return role;
    }

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    public boolean isStaff() {
        return role.isStaff();
    }

    public boolean isPatient() {
        return role == UserRole.PATIENT;
    }

    public boolean isDoctor() {
        return role == UserRole.DOCTOR;
    }

    public String getDisplayLabel() {
        return fullName + " (" + role.getDisplayName() + ")";
    }
}
