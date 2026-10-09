package com.medcare.accesscontrol;

import com.medcare.accesscontrol.AccountService;
import com.medcare.accesscontrol.StaffService;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.domain.User;
import com.medcare.common.security.AuthInterceptor;
import com.medcare.common.security.SessionUser;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Component 04 - Access Control.
 *
 * <p>Login page, session handling and the shared "who am I" endpoint every page
 * uses to render the sidebar and to hide functions the role may not use.</p>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController extends BaseController {

    private final AccountService accountService;
    private final StaffService staffService;
    private final AuditLogService auditLog;

    public AuthController(AccountService accountService, StaffService staffService, AuditLogService auditLog) {
        super(accountService);
        this.accountService = accountService;
        this.staffService = staffService;
        this.auditLog = auditLog;
    }

    public record LoginRequest(String username, String password) {
    }

    public record PasswordRequest(String currentPassword, String newPassword) {
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        User user = accountService.authenticate(request.username(), request.password());
        HttpSession session = httpRequest.getSession(true);
        SessionUser principal = new SessionUser(user);
        session.setAttribute(AuthInterceptor.SESSION_USER, principal);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Welcome back, " + user.getFullName());
        body.put("user", Dto.user(user));
        return body;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpSession session) {
        SessionUser principal = sessionUser(session);
        session.invalidate();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "You have been signed out");
        body.put("user", principal.getUsername());
        return body;
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        User user = actor(session);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user", Dto.user(user));
        return body;
    }

    @PostMapping("/change-password")
    public Map<String, Object> changePassword(@RequestBody PasswordRequest request, HttpSession session) {
        User user = actor(session);
        staffService.changeOwnPassword(user, request.currentPassword(), request.newPassword());
        auditLog.record(4, "PASSWORD", user, "Password changed from the account menu");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Your password has been updated");
        return body;
    }
}
