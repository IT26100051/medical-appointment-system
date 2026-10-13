package com.medcare.availability;

import com.medcare.accesscontrol.AccountService;
import com.medcare.availability.AvailabilityForm;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.ScheduleService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.doctormanagement.Doctor;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Component 05 - Doctor Availability and Schedule Management. */
@RestController
@RequestMapping("/api/slots")
public class ScheduleController extends BaseController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService, AccountService accountService) {
        super(accountService);
        this.scheduleService = scheduleService;
    }

    // CREATE - Availability Creation Page
    @PostMapping
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> create(@Valid @RequestBody AvailabilityForm form, HttpSession session) {
        List<DoctorAvailability> created = scheduleService.create(form, actor(session));
        return Map.of("message", created.size() + " availability slot(s) created",
                "slots", created.stream().map(Dto::slot).toList());
    }

    // READ - Doctor Schedule Page / Available Slots List
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) Long doctorId,
                                    @RequestParam(required = false)
                                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false)
                                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false, defaultValue = "false") boolean openOnly,
                                    HttpSession session) {
        var slots = openOnly
                ? scheduleService.openSlots(doctorId, from)
                : scheduleService.search(doctorId, from, to, status, actor(session));
        return Map.of("slots", slots.stream().map(Dto::slot).toList(), "count", slots.size());
    }

    // UPDATE - slot blocking and time changes
    @PostMapping("/{id}/block")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> block(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                     HttpSession session) {
        String reason = body == null ? null : body.get("reason");
        DoctorAvailability slot = scheduleService.block(id, reason, actor(session));
        return Map.of("message", "Slot on " + slot.getSlotDate() + " " + slot.getStartTime()
                + " blocked", "slot", Dto.slot(slot));
    }

    @PostMapping("/{id}/unblock")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> unblock(@PathVariable Long id, HttpSession session) {
        DoctorAvailability slot = scheduleService.unblock(id, actor(session));
        return Map.of("message", "Slot on " + slot.getSlotDate() + " " + slot.getStartTime()
                + " is available again", "slot", Dto.slot(slot));
    }

    @PostMapping("/{id}/time")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> changeTime(@PathVariable Long id, @RequestBody Map<String, String> body,
                                          HttpSession session) {
        LocalTime start = LocalTime.parse(body.get("startTime"));
        LocalTime end = LocalTime.parse(body.get("endTime"));
        DoctorAvailability slot = scheduleService.changeTime(id, start, end, actor(session));
        return Map.of("message", "Slot time changed to " + slot.getStartTime() + " - " + slot.getEndTime(),
                "slot", Dto.slot(slot));
    }

    // DELETE - unused slots only
    @DeleteMapping("/{id}")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        return Map.of("message", scheduleService.delete(id, actor(session)));
    }
}
