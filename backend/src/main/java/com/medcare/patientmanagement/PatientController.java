package com.medcare.patientmanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.security.RequireRole;
import com.medcare.common.security.SessionUser;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientForm;
import com.medcare.patientmanagement.PatientService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
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

/**
 * Component 01 - Patient Management (REST endpoints behind the UI pages).
 *
 * <p>Registration page, list/search page, profile page and profile update page
 * all talk to these endpoints. Notice how thin the controller is: it validates
 * the form, calls the service and returns data - no business logic here at all.</p>
 */
@RestController
@RequestMapping("/api/patients")
public class PatientController extends BaseController {

    private final PatientService patientService;

    public PatientController(PatientService patientService, AccountService accountService) {
        super(accountService);
        this.patientService = patientService;
    }

    // CREATE - Patient Registration Page
    @PostMapping
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST})
    public Map<String, Object> register(@Valid @RequestBody PatientForm form, HttpSession session) {
        Patient patient = patientService.register(form, actor(session));
        return Map.of("message", "Patient '" + patient.getFullName() + "' registered successfully",
                "patient", Dto.user(patient));
    }

    // READ - Patient List and Search Page
    @GetMapping
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST})
    public Map<String, Object> list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        List<Patient> patients = activeOnly ? patientService.findActive() : patientService.search(q, status);
        return Map.of("patients", patients.stream().map(Dto::user).toList(),
                "count", patients.size());
    }

    /** Used by the booking screen - a doctor may read the basic patient list. */
    @GetMapping("/options")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> options() {
        List<Patient> patients = patientService.findActive();
        return Map.of("patients", patients.stream().map(Dto::user).toList());
    }

    // READ - Patient Profile Page (staff can view anyone, a patient only themselves)
    @GetMapping("/{id}")
    public Map<String, Object> view(@PathVariable Long id, HttpSession session) {
        SessionUser me = sessionUser(session);
        if (me.isPatient() && !me.getId().equals(id)) {
            throw new com.medcare.common.exception.AccessDeniedException("You can only view your own profile");
        }
        Patient patient = patientService.getRequired(id);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("patient", Dto.user(patient));
        return body;
    }

    // READ - the logged-in patient's own profile
    @GetMapping("/me")
    @RequireRole(UserRole.PATIENT)
    public Map<String, Object> myProfile(HttpSession session) {
        Patient patient = patientService.getRequired(sessionUser(session).getId());
        return Map.of("patient", Dto.user(patient));
    }

    // UPDATE - Patient Profile Update Page
    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @Valid @RequestBody PatientForm form,
                                      HttpSession session) {
        SessionUser me = sessionUser(session);
        Patient patient;
        if (me.isPatient()) {
            patient = patientService.updateOwnProfile(id, form, actor(session));
        } else {
            patient = patientService.update(id, form, actor(session));
        }
        return Map.of("message", "Profile of " + patient.getFullName() + " updated",
                "patient", Dto.user(patient));
    }

    // UPDATE - account status toggle
    @PostMapping("/{id}/status")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST})
    public Map<String, Object> changeStatus(@PathVariable Long id, @RequestParam boolean active,
                                            HttpSession session) {
        Patient patient = patientService.setActive(id, active, actor(session));
        return Map.of("message", "Account status of " + patient.getFullName() + " is now "
                + patient.getStatusLabel(), "patient", Dto.user(patient));
    }

    // DELETE - remove test records / deactivate real accounts
    @DeleteMapping("/{id}")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        String message = patientService.deleteOrDeactivate(id, actor(session));
        return Map.of("message", message);
    }
}
