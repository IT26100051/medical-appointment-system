package com.medcare.accesscontrol;

import com.medcare.accesscontrol.UserRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.UnauthenticatedException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.photos.PhotoStorage;
import com.medcare.common.security.PasswordUtil;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p><b>Abstraction.</b> All account concerns - username uniqueness, password
 * hashing, login checking, active-account enforcement - live here, once. The
 * patient, doctor and staff services simply call this class, and no controller
 * ever touches a password or the {@code active} flag directly.</p>
 */
@Service
public class AccountService {

    private final UserRepository userRepository;
    private final AuditLogService auditLog;
    private final PhotoStorage photoStorage;

    public AccountService(UserRepository userRepository, AuditLogService auditLog, PhotoStorage photoStorage) {
        this.userRepository = userRepository;
        this.auditLog = auditLog;
        this.photoStorage = photoStorage;
    }

    /**
     * Verifies the credentials of any {@link User} subtype and returns the
     * account. Failed attempts are recorded in the login activity file.
     */
    @Transactional
    public User authenticate(String username, String rawPassword) {
        Optional<User> found = userRepository.findByUsernameIgnoreCase(username == null ? "" : username.trim());
        if (found.isEmpty()) {
            auditLog.recordLogin("LOGIN-FAIL", "anonymous", "No account exists for username '" + username + "'");
            throw new UnauthenticatedException("The username or password is incorrect");
        }
        User user = found.get();
        if (!PasswordUtil.matches(rawPassword, user.getPasswordHash())) {
            auditLog.recordLogin("LOGIN-FAIL", user.getUsername() + " (" + user.getRole().name() + ")",
                    "Wrong password supplied");
            throw new UnauthenticatedException("The username or password is incorrect");
        }
        if (!user.isActive()) {
            auditLog.recordLogin("LOGIN-BLOCKED", user.getUsername() + " (" + user.getRole().name() + ")",
                    "Account is deactivated");
            throw new AccessDeniedException("This account has been deactivated. Please contact the administrator.");
        }
        auditLog.recordLogin("LOGIN-OK", user.getUsername() + " (" + user.getRole().name() + ")",
                user.getAccountType() + " '" + user.getFullName() + "' signed in");
        return user;
    }

    /** Rejects duplicate usernames (optionally ignoring the user being edited). */
    @Transactional(readOnly = true)
    public void ensureUsernameAvailable(String username, Long ignoreUserId) {
        if (username == null || username.isBlank()) {
            throw new BusinessRuleException("Username is required");
        }
        Optional<User> existing = userRepository.findByUsernameIgnoreCase(username.trim());
        if (existing.isPresent() && (ignoreUserId == null || !existing.get().getId().equals(ignoreUserId))) {
            throw new BusinessRuleException("The username '" + username + "' is already taken");
        }
    }

    /** Hashes and stores a new password. Set {@code required=false} to allow "leave blank to keep current". */
    @Transactional
    public void applyPassword(User user, String rawPassword, boolean required) {
        if (rawPassword == null || rawPassword.isBlank()) {
            if (required) {
                throw new BusinessRuleException("Password is required for a new account");
            }
            return;
        }
        user.changePassword(PasswordUtil.hash(rawPassword));
    }

    // ==================================================================
    //  Profile photographs (Component 04)
    // ==================================================================

    /**
     * Sets the profile photograph of an account.
     *
     * <p>Permission rule: everybody may change their own picture; an
     * administrator may also change anybody else's (for example when a
     * receptionist has no photograph of their own yet). Pictures uploaded here
     * are stored through {@link PhotoStorage}, and a picture that is being
     * replaced is removed from disk so the folder never grows forever.</p>
     */
    @Transactional
    public User changePhoto(Long targetUserId, String format, String payload, String fileName, User actor) {
        User target = getRequired(targetUserId);
        if (!target.getId().equals(actor.getId()) && actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("You may only change your own profile picture");
        }
        String previous = target.getPhoto();
        String stored;
        if ("library".equalsIgnoreCase(format)) {
            String choice = payload == null ? "" : payload.trim();
            if (!User.PHOTO_FILES.contains(choice)) {
                throw new BusinessRuleException("That picture is not one of the clinic's library pictures");
            }
            stored = choice;
        } else {
            stored = photoStorage.store(target.getId(), format, payload, fileName);
        }
        target.changePhoto(stored);
        User saved = userRepository.save(target);
        if (photoStorage.isUploadedPicture(previous) && !previous.equals(stored)) {
            photoStorage.remove(previous);
        }
        auditLog.record(4, "PHOTO", actor, "Profile picture updated for " + saved.getAccountType()
                + " '" + saved.getFullName() + "' (#" + saved.getId() + ")");
        return saved;
    }

    /** Takes the picture away and falls back to the default face. */
    @Transactional
    public User removePhoto(Long targetUserId, User actor) {
        User target = getRequired(targetUserId);
        if (!target.getId().equals(actor.getId()) && actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("You may only change your own profile picture");
        }
        String previous = target.getPhoto();
        target.removePhoto();
        User saved = userRepository.save(target);
        if (photoStorage.isUploadedPicture(previous)) {
            photoStorage.remove(previous);
        }
        auditLog.record(4, "PHOTO", actor, "Profile picture removed for " + saved.getAccountType()
                + " '" + saved.getFullName() + "' - the default picture is shown again");
        return saved;
    }

    @Transactional(readOnly = true)
    public User getRequired(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.of("User", userId));
    }

    /** Guard used by every component: only an active account may act. */
    @Transactional(readOnly = true)
    public void requireActive(User user) {
        if (user == null || !user.isActive()) {
            throw new AccessDeniedException("This account is not active");
        }
    }

    @Transactional(readOnly = true)
    public boolean roleExists(UserRole role) {
        return userRepository.countByRole(role) > 0;
    }
}
