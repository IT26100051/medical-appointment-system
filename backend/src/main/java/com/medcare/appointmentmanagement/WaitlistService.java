package com.medcare.appointmentmanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.feedback.Notification;
import com.medcare.feedback.NotificationService;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientRepository;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 03 - Appointment Management (the waiting list).
 *
 * <p><b>Abstraction.</b> This is the only place that decides what a waiting-list
 * entry may do: who can join, who can offer a free time, who can leave the list,
 * and what happens when a booking is cancelled and a time becomes free again.
 * The controller passes the signed-in person and the request; the page only
 * draws what it is given.</p>
 *
 * <p>The list is a plain queue: the person who has been waiting longest is
 * offered the first time that frees up, which is exactly how a hospital
 * reception works.</p>
 */
@Service
public class WaitlistService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("EEE d MMM");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");
    private static final List<WaitlistEntry.Status> OPEN_STATUSES =
            List.of(WaitlistEntry.Status.WAITING, WaitlistEntry.Status.OFFERED);

    private final WaitlistRepository waitlistRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AccountService accountService;
    private final NotificationService notificationService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;

    public WaitlistService(WaitlistRepository waitlistRepository,
                           PatientRepository patientRepository,
                           DoctorRepository doctorRepository,
                           AccountService accountService,
                           NotificationService notificationService,
                           DataExportService exportService,
                           AuditLogService auditLog) {
        this.waitlistRepository = waitlistRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.accountService = accountService;
        this.notificationService = notificationService;
        this.exportService = exportService;
        this.auditLog = auditLog;
    }

    // ==================================================================
    //  Joining the list
    // ==================================================================

    /** A patient asks for a place on a doctor's waiting list. */
    @Transactional
    public WaitlistEntry join(User actor, WaitlistForm form) {
        Patient patient = resolvePatient(form, actor);
        Doctor doctor = doctorRepository.findById(form.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("That doctor is not on the clinic's register"));
        if (!doctor.isActive()) {
            throw new BusinessRuleException("Dr. " + doctor.getFullName()
                    + " is not taking appointments at the moment");
        }

        LocalDate from = form.getPreferredFrom() == null ? LocalDate.now() : form.getPreferredFrom();
        if (from.isBefore(LocalDate.now())) {
            throw new BusinessRuleException("Please choose a first day from today onwards");
        }
        if (form.getPreferredTo() != null && form.getPreferredTo().isBefore(from)) {
            throw new BusinessRuleException("The last day cannot be before the first day");
        }
        if (waitlistRepository.existsByPatientIdAndDoctorIdAndStatusIn(patient.getId(), doctor.getId(), OPEN_STATUSES)) {
            throw new BusinessRuleException(patient.getFullName() + " already has a place on Dr. "
                    + doctor.getFullName() + "'s waiting list");
        }

        WaitlistEntry entry = new WaitlistEntry(patient, doctor, from, form.getPreferredTo(), form.getNote());
        WaitlistEntry saved = waitlistRepository.save(entry);
        refreshExports();
        auditLog.record(3, "WAITLIST-JOIN", actor, patient.getFullName() + " joined the waiting list for Dr. "
                + doctor.getFullName() + " (" + saved.getWindowLabel() + ")");
        return saved;
    }

    /** The clinic adds somebody over the telephone, or a patient adds themselves. */
    private Patient resolvePatient(WaitlistForm form, User actor) {
        if (actor.getRole() == UserRole.PATIENT) {
            if (form.getPatientId() != null && !form.getPatientId().equals(actor.getId())) {
                throw new AccessDeniedException("You can only join the waiting list for yourself");
            }
            return patientRepository.findById(actor.getId())
                    .orElseThrow(() -> new BusinessRuleException("Your patient record could not be found"));
        }
        if (form.getPatientId() == null) {
            throw new BusinessRuleException("Please choose the patient who is waiting");
        }
        return patientRepository.findById(form.getPatientId())
                .orElseThrow(() -> new BusinessRuleException("Please choose a registered patient"));
    }

    // ==================================================================
    //  Reading the list
    // ==================================================================

    /** The list as this person may see it: a patient sees only their own places. */
    @Transactional(readOnly = true)
    public Map<String, Object> board(User actor, Long doctorId, boolean openOnly) {
        List<WaitlistEntry> entries;
        if (actor.getRole() == UserRole.PATIENT) {
            entries = waitlistRepository.findByPatient(actor.getId());
            if (openOnly) {
                entries = entries.stream().filter(WaitlistEntry::isOpen).toList();
            }
        } else if (actor.getRole() == UserRole.DOCTOR) {
            entries = waitlistRepository.search(actor.getId(), openOnly);
        } else {
            entries = waitlistRepository.search(doctorId, openOnly);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (WaitlistEntry entry : entries) {
            rows.add(toView(entry));
        }

        /* The counts describe what this person is allowed to see - a patient is
           not told how many other people the clinic has on its lists. */
        List<WaitlistEntry> counted = entries;
        if (actor.getRole() == UserRole.PATIENT) {
            counted = waitlistRepository.findByPatient(actor.getId());
        } else if (actor.getRole() == UserRole.DOCTOR) {
            counted = waitlistRepository.search(actor.getId(), false);
        } else if (doctorId != null) {
            counted = waitlistRepository.search(doctorId, false);
        }
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("entries", rows);
        answer.put("waiting", countOf(counted, WaitlistEntry.Status.WAITING));
        answer.put("offered", countOf(counted, WaitlistEntry.Status.OFFERED));
        answer.put("booked", countOf(counted, WaitlistEntry.Status.BOOKED));
        answer.put("cancelled", countOf(counted, WaitlistEntry.Status.CANCELLED));
        return answer;
    }

    /** One entry, with a check that this person may look at it. */
    @Transactional(readOnly = true)
    public Map<String, Object> view(User actor, Long id) {
        return toView(mayTouch(actor, getRequired(id)));
    }

    // ==================================================================
    //  Offering a time, booking it, leaving the list
    // ==================================================================

    /**
     * The clinic offers a specific free time to the person at the front of the
     * queue. The patient is told at once so the time is not lost.
     */
    @Transactional
    public WaitlistEntry offer(User actor, Long id, Long slotId, String timeLabel) {
        WaitlistEntry entry = mayTouch(actor, getRequired(id));
        if (!entry.isOpen()) {
            throw new BusinessRuleException("This place on the waiting list has already been closed");
        }
        if (slotId == null) {
            throw new BusinessRuleException("Please choose one of the doctor's free times to offer");
        }
        entry.offer(slotId, timeLabel == null ? "a free time" : timeLabel);
        WaitlistEntry saved = waitlistRepository.save(entry);

        notificationService.deliver(saved.getPatient(), Notification.Type.WAITING_LIST,
                "A time has opened up with Dr. " + saved.getDoctor().getFullName(),
                "Your place on the waiting list has come up: " + saved.getOfferedTime()
                        + ". Please book it from the portal, or call the clinic - the time is kept for you for"
                        + " as long as it stays free.",
                null);
        refreshExports();
        auditLog.record(3, "WAITLIST-OFFER", actor, "Offered " + saved.getOfferedTime() + " to "
                + saved.getPatient().getFullName() + " (Dr. " + saved.getDoctor().getFullName() + ")");
        return saved;
    }

    /** The offered time has been booked - the place on the list is done. */
    @Transactional
    public WaitlistEntry markBooked(User actor, Long id) {
        WaitlistEntry entry = mayTouch(actor, getRequired(id));
        entry.markBooked();
        WaitlistEntry saved = waitlistRepository.save(entry);
        refreshExports();
        auditLog.record(3, "WAITLIST-BOOKED", actor, saved.getPatient().getFullName()
                + " booked the offered time with Dr. " + saved.getDoctor().getFullName());
        return saved;
    }

    /** The patient leaves the list (or the clinic takes them off it). */
    @Transactional
    public WaitlistEntry cancel(User actor, Long id) {
        WaitlistEntry entry = mayTouch(actor, getRequired(id));
        entry.cancel();
        WaitlistEntry saved = waitlistRepository.save(entry);
        refreshExports();
        auditLog.record(3, "WAITLIST-LEFT", actor, saved.getPatient().getFullName()
                + " left the waiting list for Dr. " + saved.getDoctor().getFullName());
        return saved;
    }

    /**
     * A booking was cancelled, so a time is free again: the person who has been
     * waiting longest is offered it straight away, and told about it.
     *
     * <p>Called by {@link AppointmentService} - one line, so the rule lives with
     * the waiting list and not with the appointment.</p>
     */
    @Transactional
    public void offerFreedSlot(Appointment appointment) {
        if (appointment == null || appointment.getDoctor() == null || appointment.getSlot() == null) {
            return;
        }
        List<WaitlistEntry> waiting = waitlistRepository.findWaitingForDoctor(appointment.getDoctor().getId());
        if (waiting.isEmpty()) {
            return;
        }
        /* the longest-waiting patient whose own window contains the freed day:
           a time nobody can attend is not offered to anybody */
        WaitlistEntry first = waiting.stream()
                .filter(entry -> entry.suits(appointment.getAppointmentDate()))
                .findFirst()
                .orElse(null);
        if (first == null) {
            return;
        }
        String label = DATE_FMT.format(appointment.getAppointmentDate()) + " at "
                + TIME_FMT.format(appointment.getStartTime());
        first.offer(appointment.getSlot().getId(), label);
        waitlistRepository.save(first);

        notificationService.deliver(first.getPatient(), Notification.Type.WAITING_LIST,
                "A time has opened up with Dr. " + appointment.getDoctor().getFullName(),
                "A patient has just released " + label + ", and you are first on the waiting list. "
                        + "Please book it from the portal or call the clinic.",
                appointment.getId());
        refreshExports();
        auditLog.record(3, "WAITLIST-OFFER", first.getPatient(), "Freed time " + label + " offered automatically"
                + " to " + first.getPatient().getFullName());
    }

    /**
     * Somebody else booked the time that had been offered to a patient on the
     * waiting list: the offer is taken back and the patient keeps their place.
     */
    @Transactional
    public void releaseTakenOffers(Appointment appointment) {
        if (appointment == null || appointment.getSlot() == null) {
            return;
        }
        Long slotId = appointment.getSlot().getId();
        for (WaitlistEntry entry : waitlistRepository
                .findByStatusInOrderByCreatedAtAsc(List.of(WaitlistEntry.Status.OFFERED))) {
            if (!slotId.equals(entry.getOfferedSlotId())) {
                continue;
            }
            if (entry.getPatient().getId().equals(appointment.getPatient().getId())) {
                continue;                            /* they took their own offer */
            }
            String was = entry.getOfferedTime();
            entry.offerTaken();
            waitlistRepository.save(entry);
            notificationService.deliver(entry.getPatient(), Notification.Type.WAITING_LIST,
                    "That time was taken - you keep your place on the waiting list",
                    (was == null ? "The offered time" : was) + " has just been booked by another patient. "
                            + "You are still on Dr. " + entry.getDoctor().getFullName()
                            + "'s waiting list and the next free time will be offered to you.",
                    appointment.getId());
            auditLog.record(3, "WAITLIST-OFFER-TAKEN", entry.getPatient(),
                    "Offered time " + was + " was booked by another patient; the place stays on the list");
        }
        refreshExports();
    }

    /** When a patient books with a doctor, any open place of theirs on that list is closed. */
    @Transactional
    public void closePlacesFor(Appointment appointment) {
        if (appointment == null || appointment.getPatient() == null || appointment.getDoctor() == null) {
            return;
        }
        List<WaitlistEntry> mine = waitlistRepository.findByPatient(appointment.getPatient().getId()).stream()
                .filter(WaitlistEntry::isOpen)
                .filter(entry -> entry.getDoctor().getId().equals(appointment.getDoctor().getId()))
                .toList();
        if (mine.isEmpty()) {
            return;
        }
        mine.forEach(WaitlistEntry::markBooked);
        waitlistRepository.saveAll(mine);
        refreshExports();
    }

    // ==================================================================
    //  Helpers
    // ==================================================================

    private WaitlistEntry getRequired(Long id) {
        return waitlistRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Waitlist entry #" + id + " was not found"));
    }

    /**
     * Who may act on an entry: the patient it belongs to, the doctor it is for,
     * the front desk and the administrator.
     */
    private WaitlistEntry mayTouch(User actor, WaitlistEntry entry) {
        UserRole role = actor.getRole();
        if (role == UserRole.ADMIN || role == UserRole.RECEPTIONIST) {
            return entry;
        }
        if (role == UserRole.DOCTOR && entry.getDoctor().getId().equals(actor.getId())) {
            return entry;
        }
        if (role == UserRole.PATIENT && entry.getPatient().getId().equals(actor.getId())) {
            return entry;
        }
        throw new AccessDeniedException("This place on the waiting list belongs to another patient");
    }

    /** The shape the pages and the text file use. */
    private Map<String, Object> toView(WaitlistEntry entry) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entry.getId());
        row.put("patientId", entry.getPatient().getId());
        row.put("patientName", entry.getPatient().getFullName());
        row.put("patientPhoto", entry.getPatient().getPhotoUrl());
        row.put("patientPhone", entry.getPatient().getPhone());
        row.put("doctorId", entry.getDoctor().getId());
        row.put("doctorName", entry.getDoctor().getFullName());
        row.put("doctorPhoto", entry.getDoctor().getPhotoUrl());
        row.put("specialization", entry.getDoctor().getSpecialization());
        row.put("window", entry.getWindowLabel());
        row.put("note", entry.getNote());
        row.put("status", entry.getStatus().name());
        row.put("statusLabel", entry.getStatusLabel());
        row.put("open", entry.isOpen());
        row.put("offeredSlotId", entry.getOfferedSlotId());
        row.put("offeredTime", entry.getOfferedTime());
        row.put("offeredStamp", entry.getOfferedStamp());
        row.put("createdStamp", entry.getCreatedStamp());
        row.put("waitingSince", entry.getCreatedAt().toLocalDate().toString());
        return row;
    }

    /** The waiting-list file and the clinic summary, kept in step with the data. */
    private void refreshExports() {
        exportService.refreshWaitlist();
        exportService.refreshSummary();
    }

    /** How many of these places stand in the given state. */
    private long countOf(List<WaitlistEntry> entries, WaitlistEntry.Status status) {
        return entries.stream().filter(entry -> entry.getStatus() == status).count();
    }
}
