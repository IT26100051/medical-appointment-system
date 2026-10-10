package com.medcare.accesscontrol;

import com.medcare.accesscontrol.Staff;
import com.medcare.accesscontrol.StaffForm;
import com.medcare.accesscontrol.UserRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.documents.OutputFile;
import com.medcare.common.documents.TextFileService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.form.UserForm;
import com.medcare.common.security.PasswordUtil;
import com.medcare.feedback.NotificationService;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p><b>Polymorphism.</b> The same account workflow serves both the
 * administrator and the receptionist role - the role carried by the
 * {@link StaffForm} (which extends {@code UserForm}) decides the permissions the
 * new account will have.</p>
 */
@Service
public class StaffService {

    private final UserRepository userRepository;
    private final AccountService accountService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;
    private final TextFileService textFileService;
    private final NotificationService notificationService;

    public StaffService(UserRepository userRepository,
                        AccountService accountService,
                        DataExportService exportService,
                        AuditLogService auditLog,
                        TextFileService textFileService,
                        NotificationService notificationService) {
        this.userRepository = userRepository;
        this.accountService = accountService;
        this.exportService = exportService;
        this.auditLog = auditLog;
        this.textFileService = textFileService;
        this.notificationService = notificationService;
    }

    // ---------------- CREATE ----------------

    @Transactional
    public Staff register(StaffForm form, User actor) {
        requireAdmin(actor);
        if (form.getRole() != UserRole.ADMIN && form.getRole() != UserRole.RECEPTIONIST) {
            throw new BusinessRuleException("Only administrator or receptionist accounts can be created here");
        }
        accountService.ensureUsernameAvailable(form.getUsername(), null);

        Staff staff = new Staff();
        form.applyTo(staff);
        accountService.applyPassword(staff, form.getPassword(), true);

        Staff saved = userRepository.save(staff);
        exportService.refreshStaff();
        exportService.refreshSummary();
        auditLog.record(4, "CREATE", actor, "Created " + saved.getRole().name() + " account #" + saved.getId()
                + " - " + saved.getFullName() + " (username " + saved.getUsername() + ")");
        notificationService.notifyAccountChange(saved, "Account created",
                "Your " + saved.getRole().getDisplayName().toLowerCase()
                        + " account has been created. Please change your password after the first sign-in.");
        return saved;
    }

    // ---------------- READ ----------------

    @Transactional(readOnly = true)
    public List<User> search(String keyword) {
        return userRepository.searchStaff(keyword == null || keyword.isBlank() ? null : keyword.trim());
    }

    @Transactional(readOnly = true)
    public User getRequired(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Staff account", id));
    }

    /** Last lines of the audit trail - the "activity information" of staff work. */
    @Transactional(readOnly = true)
    public List<String> recentActivity(String usernameFilter, int maxLines) {
        if (!textFileService.exists(OutputFile.AUDIT_LOG)) {
            return List.of();
        }
        return textFileService.read(OutputFile.AUDIT_LOG).lines()
                .filter(line -> line.contains("|"))
                .filter(line -> usernameFilter == null || usernameFilter.isBlank()
                        || line.toLowerCase(Locale.ROOT).contains(usernameFilter.toLowerCase(Locale.ROOT)))
                .skip(Math.max(0, countMatching(usernameFilter) - maxLines))
                .toList();
    }

    private long countMatching(String usernameFilter) {
        return textFileService.read(OutputFile.AUDIT_LOG).lines()
                .filter(line -> line.contains("|"))
                .filter(line -> usernameFilter == null || usernameFilter.isBlank()
                        || line.toLowerCase(Locale.ROOT).contains(usernameFilter.toLowerCase(Locale.ROOT)))
                .count();
    }

    @Transactional(readOnly = true)
    public long activeStaffCount() {
        return userRepository.countByRoleAndActiveTrue(UserRole.ADMIN)
                + userRepository.countByRoleAndActiveTrue(UserRole.RECEPTIONIST);
    }

    // ---------------- UPDATE ----------------

    @Transactional
    public Staff update(Long id, StaffForm form, User actor) {
        User user = getRequired(id);
        if (!(user instanceof Staff staff)) {
            throw new BusinessRuleException("Only staff accounts can be edited here");
        }
        boolean self = actor.getId().equals(staff.getId());
        if (!self) {
            requireAdmin(actor);
        }
        accountService.ensureUsernameAvailable(form.getUsername(), staff.getId());

        if (self && form.getRole() != staff.getRole()) {
            throw new BusinessRuleException("You cannot change your own role");
        }
        if (staff.getRole() == UserRole.ADMIN && form.getRole() != UserRole.ADMIN) {
            ensureAnotherAdminExists(staff.getId());
        }
        if (Boolean.FALSE.equals(form.getActive()) && self) {
            throw new BusinessRuleException("You cannot deactivate your own account");
        }

        form.applyTo(staff);
        if (form.hasPassword()) {
            accountService.applyPassword(staff, form.getPassword(), true);
        }
        Staff saved = userRepository.save(staff);
        exportService.refreshStaff();
        exportService.refreshSummary();
        auditLog.record(4, "UPDATE", actor, "Updated staff account #" + saved.getId() + " - "
                + saved.getFullName() + " (" + saved.getRole().name() + ", " + saved.getStatusLabel() + ")");
        return saved;
    }

    @Transactional
    public Staff setActive(Long id, boolean active, User actor) {
        requireAdmin(actor);
        User user = getRequired(id);
        if (!(user instanceof Staff staff)) {
            throw new BusinessRuleException("Only staff accounts can be activated or deactivated here");
        }
        if (staff.getId().equals(actor.getId())) {
            throw new BusinessRuleException("You cannot deactivate your own account");
        }
        if (!active) {
            ensureAnotherAdminExists(staff.getId());
        }
        staff.applyActiveFlag(active);
        Staff saved = userRepository.save(staff);
        exportService.refreshStaff();
        exportService.refreshSummary();
        auditLog.record(4, active ? "ACTIVATE" : "DEACTIVATE", actor, "Staff account #" + saved.getId()
                + " - " + saved.getFullName() + " set to " + saved.getStatusLabel());
        return saved;
    }

    /** Any logged-in user may change their own password with the current one. */
    @Transactional
    public void changeOwnPassword(User actor, String currentPassword, String newPassword) {
        if (!com.medcare.common.security.PasswordUtil.matches(currentPassword, actor.getPasswordHash())) {
            throw new BusinessRuleException("The current password is incorrect");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessRuleException("The new password must be at least 6 characters long");
        }
        accountService.applyPassword(actor, newPassword, true);
        userRepository.save(actor);
        auditLog.record(4, "PASSWORD", actor, "Password changed for account " + actor.getUsername());
    }

    // ---------------- DELETE ----------------

    @Transactional
    public String deleteOrDeactivate(Long id, User actor) {
        requireAdmin(actor);
        User user = getRequired(id);
        if (user.getId().equals(actor.getId())) {
            throw new BusinessRuleException("You cannot delete your own account");
        }
        if (user.getRole() == UserRole.ADMIN) {
            ensureAnotherAdminExists(user.getId());
        }
        boolean hasActivity = hasRecordedActivity(user.getUsername());
        if (hasActivity || user.isActive()) {
            user.deactivate();
            userRepository.save(user);
            exportService.refreshStaff();
            exportService.refreshSummary();
            auditLog.record(4, "DEACTIVATE", actor, "Staff account #" + id + " - " + user.getFullName()
                    + " deactivated (activity history preserved)");
            return "This account has recorded activity, so it was DEACTIVATED instead of deleted. "
                    + "Its history in the audit trail is preserved.";
        }
        auditLog.record(4, "DELETE", actor, "Deleted unused staff test account #" + id + " - " + user.getFullName());
        userRepository.delete(user);
        exportService.refreshStaff();
        exportService.refreshSummary();
        return "Unused staff test account deleted from the system.";
    }

    private boolean hasRecordedActivity(String username) {
        if (!textFileService.exists(OutputFile.AUDIT_LOG)) {
            return false;
        }
        return textFileService.read(OutputFile.AUDIT_LOG).lines()
                .filter(line -> line.contains("|"))
                .anyMatch(line -> line.toLowerCase(Locale.ROOT).contains(username.toLowerCase(Locale.ROOT)));
    }

    /** Guards the system against locking itself out of administration. */
    private void ensureAnotherAdminExists(Long excludedUserId) {
        boolean otherAdmin = userRepository.findByRoleOrderByFullNameAsc(UserRole.ADMIN).stream()
                .anyMatch(u -> u.isActive() && !u.getId().equals(excludedUserId));
        if (!otherAdmin) {
            throw new BusinessRuleException("At least one active administrator account must remain");
        }
    }

    private void requireAdmin(User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Only an administrator can manage staff accounts");
        }
    }
}
