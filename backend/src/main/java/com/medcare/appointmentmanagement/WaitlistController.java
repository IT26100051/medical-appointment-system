package com.medcare.appointmentmanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.web.BaseController;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Component 03 - Appointment Management (the waiting list).
 *
 * <p><b>Abstraction.</b> The controller only hands the signed-in person and the
 * request to {@link WaitlistService}; every rule about who may join, offer,
 * book or leave lives in the service and in the entry itself.</p>
 *
 * <p>Everyone signed in may reach these addresses. What each person may
 * <i>see and do</i> is narrower and is decided inside the service - a patient
 * only ever sees and closes their own places on the list.</p>
 */
@RestController
@RequestMapping("/api/waitlist")
@RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT})
public class WaitlistController extends BaseController {

    private final WaitlistService waitlistService;

    public WaitlistController(AccountService accountService, WaitlistService waitlistService) {
        super(accountService);
        this.waitlistService = waitlistService;
    }

    /** The list as this person may see it. */
    @GetMapping
    public Map<String, Object> board(@RequestParam(required = false) Long doctorId,
                                     @RequestParam(defaultValue = "false") boolean openOnly,
                                     HttpSession session) {
        return waitlistService.board(actor(session), doctorId, openOnly);
    }

    /** One entry. */
    @GetMapping("/{id}")
    public Map<String, Object> view(@PathVariable Long id, HttpSession session) {
        return waitlistService.view(actor(session), id);
    }

    /** A patient (or the clinic over the telephone) takes a place on the list. */
    @PostMapping
    public Map<String, Object> join(@RequestBody WaitlistForm form, HttpSession session) {
        User me = actor(session);
        WaitlistEntry entry = waitlistService.join(me, form);
        return Map.of(
                "message", "You are on the waiting list - we will tell you the moment a time frees up",
                "entry", waitlistService.view(me, entry.getId()));
    }

    /** The clinic offers one of the doctor's free times to the person waiting longest. */
    @PostMapping("/{id}/offer")
    public Map<String, Object> offer(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                     HttpSession session) {
        Long slotId = body.get("slotId") == null ? null : Long.valueOf(String.valueOf(body.get("slotId")));
        String timeLabel = body.get("timeLabel") == null ? null : String.valueOf(body.get("timeLabel"));
        waitlistService.offer(actor(session), id, slotId, timeLabel);
        return Map.of("message", "The time has been offered and the patient has been told");
    }

    /** The offered time has been booked. */
    @PostMapping("/{id}/booked")
    public Map<String, Object> booked(@PathVariable Long id, HttpSession session) {
        waitlistService.markBooked(actor(session), id);
        return Map.of("message", "This place on the waiting list is complete");
    }

    /** Leaving the list (the patient, or the clinic on their behalf). */
    @PostMapping("/{id}/leave")
    public Map<String, Object> leave(@PathVariable Long id, HttpSession session) {
        waitlistService.cancel(actor(session), id);
        return Map.of("message", "Taken off the waiting list");
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> remove(@PathVariable Long id, HttpSession session) {
        waitlistService.cancel(actor(session), id);
        return Map.of("message", "Removed from the waiting list");
    }
}
