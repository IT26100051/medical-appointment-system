package com.medcare.accesscontrol;

import com.medcare.accesscontrol.AccountService;
import com.medcare.accesscontrol.Staff;
import com.medcare.accesscontrol.StaffForm;
import com.medcare.accesscontrol.StaffService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Component 04 - Staff Management Panel (administrator / receptionist accounts). */
@RestController
@RequestMapping("/api/staff")
@RequireRole(UserRole.ADMIN)
public class StaffController extends BaseController {

    private final StaffService staffService;

    public StaffController(StaffService staffService, AccountService accountService) {
        super(accountService);
        this.staffService = staffService;
    }

    // CREATE - Staff Registration Page
    @PostMapping
    public Map<String, Object> register(@Valid @RequestBody StaffForm form, HttpSession session) {
        Staff staff = staffService.register(form, actor(session));
        return Map.of("message", staff.getRole().getDisplayName() + " account created for "
                + staff.getFullName(), "staff", Dto.user(staff));
    }

    // READ - Staff Management Panel
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String q) {
        List<?> staff = staffService.search(q).stream().map(Dto::user).toList();
        return Map.of("staff", staff, "count", staff.size(),
                "roles", List.of(
                        Map.of("value", "ADMIN", "label", UserRole.ADMIN.getDisplayName()),
                        Map.of("value", "RECEPTIONIST", "label", UserRole.RECEPTIONIST.getDisplayName())));
    }

    /** Activity information from the audit trail. */
    @GetMapping("/activity")
    public Map<String, Object> activity(@RequestParam(required = false) String username,
                                        @RequestParam(defaultValue = "60") int limit) {
        return Map.of("entries", staffService.recentActivity(username, limit));
    }

    // UPDATE - Staff Management Panel editor
    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @Valid @RequestBody StaffForm form,
                                      HttpSession session) {
        Staff staff = staffService.update(id, form, actor(session));
        return Map.of("message", "Staff account of " + staff.getFullName() + " updated",
                "staff", Dto.user(staff));
    }

    @PostMapping("/{id}/status")
    public Map<String, Object> changeStatus(@PathVariable Long id, @RequestParam boolean active,
                                            HttpSession session) {
        Staff staff = staffService.setActive(id, active, actor(session));
        return Map.of("message", staff.getFullName() + " is now " + staff.getStatusLabel(),
                "staff", Dto.user(staff));
    }

    // DELETE - unused test accounts only
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        return Map.of("message", staffService.deleteOrDeactivate(id, actor(session)));
    }
}
