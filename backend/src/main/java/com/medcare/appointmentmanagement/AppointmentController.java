package com.medcare.appointmentmanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentForm;
import com.medcare.appointmentmanagement.AppointmentService;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.ScheduleService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.LocalDate;
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

/** Component 03 - Appointment Management (booking, list, details, reschedule/cancel). */
@RestController
@RequestMapping("/api/appointments")
public class AppointmentController extends BaseController {

    private final AppointmentService appointmentService;
    private final QueueService queueService;
    private final ScheduleService scheduleService;

    public AppointmentController(AppointmentService appointmentService, ScheduleService scheduleService,
                                 QueueService queueService, AccountService accountService) {
        super(accountService);
        this.appointmentService = appointmentService;
        this.scheduleService = scheduleService;
        this.queueService = queueService;
    }

    // CREATE - Book Appointment Page
    @PostMapping
    public Map<String, Object> book(@Valid @RequestBody AppointmentForm form, HttpSession session) {
        Appointment appointment = appointmentService.book(form, actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo() + " booked for "
                + appointment.getPatient().getFullName(), "appointment", Dto.appointment(appointment));
    }

    // READ - Appointment List Page (role based)
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) Long patientId,
                                    @RequestParam(required = false) Long doctorId,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                    @RequestParam(required = false) String q,
                                    HttpSession session) {
        var appointments = appointmentService.search(actor(session), patientId, doctorId, status, from, to, q);
        var tokens = queueService.tokensFor(appointments);
        return Map.of("appointments", appointments.stream()
                        .map(a -> Dto.appointment(a, tokens.get(a.getId()))).toList(),
                "count", appointments.size());
    }

    // READ - Appointment Details/Manage Page
    @GetMapping("/{id}")
    public Map<String, Object> view(@PathVariable Long id, HttpSession session) {
        Appointment appointment = appointmentService.detail(id, actor(session));
        var alternatives = appointment.getDoctor() == null
                ? java.util.List.<com.medcare.availability.DoctorAvailability>of()
                : scheduleService.openSlots(appointment.getDoctor().getId(), LocalDate.now());
        return Map.of("appointment", Dto.appointment(appointment, queueService.tokenOf(appointment)),
                "alternativeSlots", alternatives.stream()
                        .filter(s -> !s.getId().equals(appointment.getSlot() == null ? -1L : appointment.getSlot().getId()))
                        .map(Dto::slot).toList());
    }

    /** Available slots for the booking screen. */
    @GetMapping("/slots")
    public Map<String, Object> slots(@RequestParam Long doctorId,
                                     @RequestParam(required = false)
                                     @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from) {
        var slots = scheduleService.openSlots(doctorId, from);
        return Map.of("slots", slots.stream().map(Dto::slot).toList());
    }

    // UPDATE - confirm / complete / cancel / reschedule
    @PostMapping("/{id}/confirm")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> confirm(@PathVariable Long id, HttpSession session) {
        Appointment appointment = appointmentService.confirm(id, actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo() + " confirmed",
                "appointment", Dto.appointment(appointment));
    }

    @PostMapping("/{id}/complete")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> complete(@PathVariable Long id,
                                        @RequestBody(required = false) Map<String, String> body,
                                        HttpSession session) {
        String notes = body == null ? null : body.get("notes");
        String summary = body == null ? null : body.get("visitSummary");
        String followUpNotes = body == null ? null : body.get("followUpNotes");
        LocalDate followUp = body == null || body.get("followUpDate") == null || body.get("followUpDate").isBlank()
                ? null : LocalDate.parse(body.get("followUpDate"));
        Appointment appointment = appointmentService.complete(id, notes, summary, followUp, followUpNotes,
                actor(session));
        return Map.of("message", followUp == null
                        ? "Appointment " + appointment.getReferenceNo() + " marked as completed"
                        : "Appointment " + appointment.getReferenceNo() + " completed and a follow-up visit "
                                + "noted for " + followUp,
                "appointment", Dto.appointment(appointment));
    }

    /** Routine / urgent / follow-up - the clinic can reprioritise a booking at any time. */
    @PostMapping("/{id}/priority")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> priority(@PathVariable Long id, @RequestBody Map<String, String> body,
                                        HttpSession session) {
        Appointment appointment = appointmentService.changePriority(id, body.get("priority"), actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo() + " marked as "
                        + appointment.getPriority().getLabel(),
                "appointment", Dto.appointment(appointment));
    }

    /**
     * The check-in pass. The page draws the code from this; the same summary is
     * what a receptionist reads out when the patient arrives at the desk.
     */
    @GetMapping("/{id}/pass")
    public Map<String, Object> pass(@PathVariable Long id, HttpSession session) {
        return Map.of("pass", appointmentService.checkInPass(id, actor(session)));
    }

    @PostMapping("/{id}/cancel")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT})
    public Map<String, Object> cancel(@PathVariable Long id, @RequestBody Map<String, String> body,
                                      HttpSession session) {
        Appointment appointment = appointmentService.cancel(id, body.get("reason"), actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo()
                + " cancelled and kept in history. The slot is available again.",
                "appointment", Dto.appointment(appointment));
    }

    @PostMapping("/{id}/reschedule")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT})
    public Map<String, Object> reschedule(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                          HttpSession session) {
        Long newSlotId = body.get("slotId") == null ? null : Long.valueOf(String.valueOf(body.get("slotId")));
        Appointment appointment = appointmentService.reschedule(id, newSlotId, actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo() + " rescheduled to "
                + appointment.getAppointmentDate() + " " + appointment.getStartTime(),
                "appointment", Dto.appointment(appointment));
    }

    /** Correction path: put a completed appointment back to Confirmed. */
    @PostMapping("/{id}/reopen")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> reopen(@PathVariable Long id, HttpSession session) {
        Appointment appointment = appointmentService.reopen(id, actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo()
                + " reopened and set back to " + appointment.getStatus().getLabel(),
                "appointment", Dto.appointment(appointment));
    }

    @PostMapping("/{id}/no-show")
    @RequireRole({UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR})
    public Map<String, Object> noShow(@PathVariable Long id, HttpSession session) {
        Appointment appointment = appointmentService.markNoShow(id, actor(session));
        return Map.of("message", "Appointment " + appointment.getReferenceNo() + " marked as no-show",
                "appointment", Dto.appointment(appointment));
    }

    // DELETE - approved test data only; cancelled appointments stay as history
    @DeleteMapping("/{id}")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        return Map.of("message", appointmentService.delete(id, actor(session)));
    }
}
