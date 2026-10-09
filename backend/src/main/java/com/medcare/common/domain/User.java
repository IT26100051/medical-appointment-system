package com.medcare.common.domain;

import com.medcare.accesscontrol.Staff;
import com.medcare.doctormanagement.Doctor;
import com.medcare.patientmanagement.Patient;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p><b>Encapsulation.</b> Every field of an account is {@code private}. The
 * only way to change an account is through the controlled methods below
 * ({@link #updateAccountDetails}, {@link #changePassword}, {@link #deactivate},
 * {@link #activate}); those methods are the single place where the
 * account-state rules live, so no controller or JSP can leave an account in an
 * invalid state.</p>
 *
 * <p><b>Inheritance / polymorphism.</b> {@code Patient}, {@code Doctor} and
 * {@code Staff} all extend this class. Shared code (login, account workflow,
 * listing) works with a {@code User} reference and still gets role specific
 * behaviour through the overridden methods.</p>
 */
@Entity
@Table(name = "app_user")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "account_type", discriminatorType = DiscriminatorType.STRING, length = 20)
public abstract class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 200)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(length = 120)
    private String email;

    @Column(length = 20)
    private String phone;

    /**
     * Gender of the person. It lives on {@link User} because every type of
     * account has one - and because it decides which default profile picture a
     * record is shown until the person uploads a picture of their own.
     */
    @Column(length = 15)
    private String gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    /**
     * File name of the person's photograph inside {@code frontend/img/people}
     * (for example {@code doctor-silva.jpg}). Chosen when the account is created
     * and shown on the profile, appointment and clinic pages.
     */
    @Column(name = "photo", length = 80)
    private String photo;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected User() {
        // required by JPA
    }

    protected User(UserRole role) {
        this.role = role;
    }

    // ------------------------------------------------------------------
    //  Controlled state changes (encapsulation)
    // ------------------------------------------------------------------

    /** Updates the shared "account" fields that every user type owns. */
    /**
     * The default face every new record starts with. Nothing has to be chosen
     * when an account is created: a person without a photograph of their own is
     * shown one of these, picked from their name and, when the record says so,
     * from the gender that was entered.
     */
    public static final String DEFAULT_PHOTO = "default-avatar.svg";
    public static final String DEFAULT_PHOTO_FEMALE = "default-avatar-female.svg";
    public static final String DEFAULT_PHOTO_MALE = "default-avatar-male.svg";

    /** Photographs from the clinic's own library that may be chosen on any profile page. */
    public static final java.util.List<String> PHOTO_FILES = java.util.List.of(
            DEFAULT_PHOTO, DEFAULT_PHOTO_FEMALE, DEFAULT_PHOTO_MALE,
            "doctor-silva.jpg", "doctor-fernando.jpg", "doctor-perera.jpg", "doctor-nawaz.jpg",
            "staff-admin.jpg", "staff-kumari.jpg", "staff-sanduni.jpg",
            "patient-nimasha.jpg", "patient-kasun.jpg", "patient-thilini.jpg",
            "patient-arun.jpg", "patient-maleesha.jpg", "patient-suresh.jpg",
            "avatar-female-1.jpg", "avatar-female-2.jpg", "avatar-male-1.jpg", "avatar-male-2.jpg");

    /**
     * Sets the profile photograph. Two kinds are accepted:
     * <ul>
     *   <li>a picture from the clinic's library ({@link #PHOTO_FILES});</li>
     *   <li>a picture the person uploaded themselves - those always carry the
     *       {@code custom-} prefix given to them by the photo storage service,
     *       which is the only place that writes such a file.</li>
     * </ul>
     * Anything else is refused, so no page can point an account at a picture
     * that does not exist.
     */
    public void changePhoto(String photo) {
        if (photo == null) {
            return;
        }
        String file = photo.trim();
        if (file.isEmpty()) {
            this.photo = null;
        } else if (PHOTO_FILES.contains(file) || isUploadedPhoto(file)) {
            this.photo = file;
        }
        this.updatedAt = LocalDateTime.now();
    }

    /** True for a picture a person uploaded themselves (stored by the photo storage service). */
    public static boolean isUploadedPhoto(String file) {
        if (file == null) {
            return false;
        }
        String lower = file.toLowerCase();
        return lower.startsWith("custom-") && lower.matches("custom-[a-z0-9-]+[.](jpg|jpeg|png|gif|webp)");
    }

    /** Takes the uploaded picture away again and falls back to the default face. */
    public void removePhoto() {
        this.photo = null;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateAccountDetails(String fullName, String email, String phone) {
        if (fullName != null && !fullName.isBlank()) {
            this.fullName = fullName.trim();
        }
        this.email = normalise(email);
        this.phone = normalise(phone);
        this.updatedAt = LocalDateTime.now();
    }

    public void changePassword(String newPasswordHash) {
        if (newPasswordHash == null || newPasswordHash.isBlank()) {
            throw new IllegalArgumentException("Password hash must not be empty");
        }
        this.passwordHash = newPasswordHash;
        this.updatedAt = LocalDateTime.now();
    }

    /** Soft delete - the account keeps its history but can no longer log in. */
    public void deactivate() {
        this.active = false;
        this.updatedAt = LocalDateTime.now();
    }

    public void activate() {
        this.active = true;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Applies an explicit active flag coming from a form. Kept separate from
     * {@link #activate()}/{@link #deactivate()} so the intent of a form update is
     * always channelled through one guarded method.
     */
    public void applyActiveFlag(Boolean activeFlag) {
        if (activeFlag == null) {
            return;
        }
        if (activeFlag) {
            activate();
        } else {
            deactivate();
        }
    }

    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    // ------------------------------------------------------------------
    //  Read access
    // ------------------------------------------------------------------

    /** Polymorphic account label used in lists and in the text reports. */
    public abstract String getAccountType();

    /** Polymorphic summary line, overridden by each user type. */
    public abstract String getProfileSummary();

    public boolean isActive() {
        return active;
    }

    public String getStatusLabel() {
        return active ? "ACTIVE" : "INACTIVE";
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    /**
     * Controlled rename of the login name. Forms go through this method (they
     * live in another package and cannot touch the field directly), so all
     * username changes still pass through one guarded entry point.
     */
    public void assignUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username must not be empty");
        }
        this.username = username.trim();
        this.updatedAt = LocalDateTime.now();
    }

    protected void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    protected void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public UserRole getRole() {
        return role;
    }

    protected void setRole(UserRole role) {
        this.role = role;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    protected static String normalise(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public String getPhoto() {
        return photo;
    }

    /**
     * Profile picture address used by the website.
     *
     * <p>A person without a picture of their own is never left with an empty
     * circle: the record falls back to the clinic's default face, and when the
     * record knows the gender it picks the matching default. Pictures uploaded
     * by the person are served from the uploads folder, everything else from
     * the clinic's picture library.</p>
     */
    public String getPhotoUrl() {
        if (photo == null || photo.isBlank()) {
            return "img/people/" + defaultPhotoFile();
        }
        return (isUploadedPhoto(photo) ? "img/uploads/" : "img/people/") + photo;
    }

    /**
     * Short file name of the picture shown when nothing has been chosen.
     * Records that know the person's gender are given the matching default face.
     */
    public String defaultPhotoFile() {
        if (gender == null) {
            return DEFAULT_PHOTO;
        }
        String value = gender.trim().toLowerCase();
        if (value.startsWith("f")) {
            return DEFAULT_PHOTO_FEMALE;
        }
        if (value.startsWith("m")) {
            return DEFAULT_PHOTO_MALE;
        }
        return DEFAULT_PHOTO;
    }

    public String getGender() {
        return gender;
    }

    /**
     * Up to two letters that represent the person, used on the default picture
     * and in the small round marks the pages draw next to a name.
     */
    public String getInitials() {
        if (fullName == null || fullName.isBlank()) {
            return "?";
        }
        StringBuilder initials = new StringBuilder();
        for (String word : fullName.trim().split("\\s+")) {
            if (!word.isEmpty() && initials.length() < 2) {
                initials.append(Character.toUpperCase(word.charAt(0)));
            }
        }
        return initials.length() == 0 ? "?" : initials.toString();
    }

    /**
     * Controlled change of the gender (used by the profile forms). An empty
     * value simply clears it; anything else is trimmed so the stored value is
     * always tidy.
     */
    public void changeGender(String gender) {
        this.gender = normalise(gender);
        this.updatedAt = LocalDateTime.now();
    }
}
