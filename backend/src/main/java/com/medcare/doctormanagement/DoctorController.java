package com.medcare.doctormanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.availability.ScheduleService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.security.SessionUser;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorForm;
import com.medcare.doctormanagement.DoctorService;
import com.medcare.feedback.FeedbackService;
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

/** Component 02 - Doctor Management (registration, list, search, profile/edit). */
@RestController
@RequestMapping("/api/doctors")
public class DoctorController extends BaseController {

    private final DoctorService doctorService;
    private final ScheduleService scheduleService;
    private final FeedbackService feedbackService;

    public DoctorController(DoctorService doctorService, ScheduleService scheduleService,
                            FeedbackService feedbackService, AccountService accountService) {
        super(accountService);
        this.doctorService = doctorService;
        this.scheduleService = scheduleService;
        this.feedbackService = feedbackService;
    }

    // CREATE - Doctor Registration Page
    @PostMapping
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST})
    public Map<String, Object> register(@Valid @RequestBody DoctorForm form, HttpSession session) {
        Doctor doctor = doctorService.register(form, actor(session));
        return Map.of("message", "Dr. " + doctor.getFullName() + " registered successfully",
                "doctor", Dto.user(doctor));
    }

    // READ - Doctor List Page / Doctor Search Page
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) String specialization,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        List<Doctor> doctors = activeOnly
                ? doctorService.findActive()
                : doctorService.search(q, specialization, status);
        return Map.of("doctors", doctors.stream().map(Dto::user).toList(),
                "count", doctors.size(),
                "specializations", doctorService.specializations());
    }

    // READ - Doctor Profile/Edit Page
    @GetMapping("/{id}")
    public Map<String, Object> view(@PathVariable Long id) {
        Doctor doctor = doctorService.getRequired(id);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("doctor", Dto.user(doctor));
        body.put("averageRating", feedbackService.averageRating(id));
        body.put("reviews", feedbackService.visibleForDoctor(id).stream().map(Dto::feedback).toList());
        body.put("upcomingSlots", scheduleService.openSlots(id, null).stream()
                .limit(20).map(Dto::slot).toList());
        return body;
    }

    // UPDATE - Doctor Profile/Edit Page
    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @Valid @RequestBody DoctorForm form,
                                      HttpSession session) {
        SessionUser me = sessionUser(session);
        Doctor doctor = me.isDoctor()
                ? doctorService.updateOwnProfile(id, form, actor(session))
                : doctorService.update(id, form, actor(session));
        return Map.of("message", "Profile of Dr. " + doctor.getFullName() + " updated",
                "doctor", Dto.user(doctor));
    }

    // UPDATE - active / inactive status
    @PostMapping("/{id}/status")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> changeStatus(@PathVariable Long id, @RequestParam boolean active,
                                            HttpSession session) {
        Doctor doctor = doctorService.setActive(id, active, actor(session));
        return Map.of("message", "Dr. " + doctor.getFullName() + " is now " + doctor.getStatusLabel(),
                "doctor", Dto.user(doctor));
    }

    // DELETE - remove unused test records / deactivate active doctors
    @DeleteMapping("/{id}")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        String message = doctorService.deleteOrDeactivate(id, actor(session));
        return Map.of("message", message);
    }
}
