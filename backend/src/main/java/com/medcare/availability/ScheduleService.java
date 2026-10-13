package com.medcare.availability;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.availability.AvailabilityForm;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 05 - Doctor Availability and Schedule Management.
 *
 * <p><b>Abstraction.</b> The overlap rule, the "no past slots" rule and the
 * allowed status transitions all live in this class. Controllers simply call
 * {@code create}, {@code block}, {@code unblock}, {@code changeTime} or
 * {@code delete} and receive a ready-made result or a business error.</p>
 */
@Service
public class ScheduleService {

    public static final LocalTime WORKING_DAY_START = LocalTime.of(6, 0);
    public static final LocalTime WORKING_DAY_END = LocalTime.of(21, 0);

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final DoctorAvailabilityRepository availabilityRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorService doctorService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;

    public ScheduleService(DoctorAvailabilityRepository availabilityRepository,
                           AppointmentRepository appointmentRepository,
                           DoctorService doctorService,
                           DataExportService exportService,
                           AuditLogService auditLog) {
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorService = doctorService;
        this.exportService = exportService;
        this.auditLog = auditLog;
    }

    // ==================================================================
    //  CREATE
    // ==================================================================

    /**
     * Creates an availability slot after checking the doctor, the date, the time
     * window and that no other slot of the same doctor overlaps it.
     */
    @Transactional
    public List<DoctorAvailability> create(AvailabilityForm form, User actor) {
        Doctor doctor = doctorService.getRequired(form.getDoctorId());
        if (!doctor.isActive()) {
            throw new BusinessRuleException("Dr. " + doctor.getFullName()
                    + " is inactive - no new slots can be created for this doctor");
        }
        validateWindow(form.getSlotDate(), form.getStartTime(), form.getEndTime());

        List<DoctorAvailability> created = new ArrayList<>();
        if (form.isRepeat()) {
            int step = doctor.getConsultationMinutes() == null ? 30 : doctor.getConsultationMinutes();
            LocalTime cursor = form.getStartTime();
            while (!cursor.plusMinutes(step).isAfter(form.getEndTime())) {
                LocalTime end = cursor.plusMinutes(step);
                DoctorAvailability slot = createSingle(doctor, form.getSlotDate(), cursor, end, form, actor);
                if (slot != null) {
                    created.add(slot);
                }
                cursor = end;
            }
            if (created.isEmpty()) {
                throw new BusinessRuleException("No slot could be created - every requested time range "
                        + "overlaps an existing slot of this doctor, or the window is shorter than one "
                        + "consultation (" + step + " minutes)");
            }
        } else {
            created.add(createSingle(doctor, form.getSlotDate(), form.getStartTime(), form.getEndTime(),
                    form, actor));
        }

        exportService.refreshSchedules();
        exportService.refreshSummary();
        auditLog.record(5, "CREATE", actor, "Created " + created.size() + " availability slot(s) for Dr. "
                + doctor.getFullName() + " on " + form.getSlotDate() + " between "
                + TIME.format(form.getStartTime()) + " and " + TIME.format(form.getEndTime()));
        return created;
    }

    private DoctorAvailability createSingle(Doctor doctor, LocalDate date, LocalTime start, LocalTime end,
                                            AvailabilityForm form, User actor) {
        long clashes = availabilityRepository.countOverlapping(doctor.getId(), date, start, end);
        if (clashes > 0) {
            if (form.isRepeat()) {
                // In repeat mode an existing slot is simply skipped instead of aborting the whole batch.
                return null;
            }
            throw new BusinessRuleException("Dr. " + doctor.getFullName() + " already has a slot that overlaps "
                    + TIME.format(start) + " - " + TIME.format(end) + " on " + date);
        }
        DoctorAvailability slot = new DoctorAvailability(doctor, date, start, end);
        BusinessRuleException.protect(() -> slot.unblock());   // sets status AVAILABLE and clears remarks
        return availabilityRepository.save(slot);
    }

    // ==================================================================
    //  READ
    // ==================================================================

    /** Role aware schedule view: a doctor only ever sees their own schedule. */
    @Transactional(readOnly = true)
    public List<DoctorAvailability> search(Long doctorId, LocalDate from, LocalDate to, String status, User actor) {
        Long scopedDoctorId = doctorId;
        if (actor.getRole() == com.medcare.common.domain.UserRole.DOCTOR) {
            scopedDoctorId = actor.getId();
        }
        DoctorAvailability.SlotStatus slotStatus = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            slotStatus = DoctorAvailability.SlotStatus.valueOf(status.toUpperCase());
        }
        return availabilityRepository.search(scopedDoctorId, from, to, slotStatus);
    }

    /** Slots a patient (or the front desk) can actually book. */
    @Transactional(readOnly = true)
    public List<DoctorAvailability> openSlots(Long doctorId, LocalDate from) {
        LocalDate start = from == null ? LocalDate.now() : from;
        return availabilityRepository.findOpenSlots(doctorId, start).stream()
                .filter(s -> LocalDateTime.of(s.getSlotDate(), s.getStartTime()).isAfter(LocalDateTime.now()))
                .toList();
    }

    @Transactional(readOnly = true)
    public DoctorAvailability getRequired(Long id) {
        return availabilityRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Availability slot", id));
    }

    @Transactional(readOnly = true)
    public long countAvailable() {
        return availabilityRepository.countUpcomingAvailable(LocalDate.now());
    }

    // ==================================================================
    //  UPDATE
    // ==================================================================

    @Transactional
    public DoctorAvailability block(Long slotId, String reason, User actor) {
        DoctorAvailability slot = getRequired(slotId);
        requireOwnership(slot, actor);
        BusinessRuleException.protect(() -> slot.block(reason));
        DoctorAvailability saved = availabilityRepository.save(slot);
        exportService.refreshSchedules();
        exportService.refreshSummary();
        auditLog.record(5, "BLOCK", actor, "Slot #" + slot.getId() + " of Dr. "
                + slot.getDoctor().getFullName() + " on " + slot.getSlotDate() + " "
                + TIME.format(slot.getStartTime()) + " blocked (" + (reason == null ? "no reason" : reason) + ")");
        return saved;
    }

    @Transactional
    public DoctorAvailability unblock(Long slotId, User actor) {
        DoctorAvailability slot = getRequired(slotId);
        requireOwnership(slot, actor);
        if (!slot.isDeleteAllowed()) {
            throw new BusinessRuleException("This slot is booked - free it through Appointment Management first");
        }
        slot.unblock();
        DoctorAvailability saved = availabilityRepository.save(slot);
        exportService.refreshSchedules();
        exportService.refreshSummary();
        auditLog.record(5, "UNBLOCK", actor, "Slot #" + slot.getId() + " of Dr. "
                + slot.getDoctor().getFullName() + " on " + slot.getSlotDate() + " "
                + TIME.format(slot.getStartTime()) + " is available again");
        return saved;
    }

    @Transactional
    public DoctorAvailability changeTime(Long slotId, LocalTime newStart, LocalTime newEnd, User actor) {
        DoctorAvailability slot = getRequired(slotId);
        requireOwnership(slot, actor);
        validateWindow(slot.getSlotDate(), newStart, newEnd);

        long clashes = availabilityRepository.countOverlappingExcluding(slot.getDoctor().getId(),
                slot.getSlotDate(), newStart, newEnd, slot.getId());
        if (clashes > 0) {
            throw new BusinessRuleException("Another slot of this doctor already occupies "
                    + TIME.format(newStart) + " - " + TIME.format(newEnd));
        }
        String before = TIME.format(slot.getStartTime()) + " - " + TIME.format(slot.getEndTime());
        BusinessRuleException.protect(() -> slot.changeTime(newStart, newEnd));
        DoctorAvailability saved = availabilityRepository.save(slot);
        exportService.refreshSchedules();
        auditLog.record(5, "UPDATE", actor, "Slot #" + slot.getId() + " time changed from " + before
                + " to " + TIME.format(newStart) + " - " + TIME.format(newEnd) + " on " + slot.getSlotDate());
        return saved;
    }

    // ==================================================================
    //  DELETE
    // ==================================================================

    @Transactional
    public String delete(Long slotId, User actor) {
        DoctorAvailability slot = getRequired(slotId);
        requireOwnership(slot, actor);
        if (!slot.isDeleteAllowed()) {
            throw new BusinessRuleException("Booked slots are never deleted - cancel or reschedule the "
                    + "appointment through Appointment Management instead");
        }
        if (appointmentRepository.existsBySlotId(slotId)) {
            throw new BusinessRuleException("This slot is linked to an appointment and must be kept");
        }
        availabilityRepository.delete(slot);
        exportService.refreshSchedules();
        exportService.refreshSummary();
        auditLog.record(5, "DELETE", actor, "Deleted " + slot.getStatusLabel().toLowerCase() + " slot #" + slotId
                + " of Dr. " + slot.getDoctor().getFullName() + " on " + slot.getSlotDate() + " "
                + TIME.format(slot.getStartTime()));
        return "Slot deleted.";
    }

    // ==================================================================
    //  Rules
    // ==================================================================

    private void validateWindow(LocalDate date, LocalTime start, LocalTime end) {
        if (date == null || start == null || end == null) {
            throw new BusinessRuleException("Date, start time and end time are required");
        }
        if (!end.isAfter(start)) {
            throw new BusinessRuleException("The end time must be after the start time");
        }
        if (start.isBefore(WORKING_DAY_START) || end.isAfter(WORKING_DAY_END)) {
            throw new BusinessRuleException("Slots must be inside clinic hours "
                    + TIME.format(WORKING_DAY_START) + " - " + TIME.format(WORKING_DAY_END));
        }
        LocalDateTime startDateTime = LocalDateTime.of(date, start);
        if (startDateTime.isBefore(LocalDateTime.now())) {
            throw new BusinessRuleException("A slot cannot be created in the past");
        }
        if (java.time.Duration.between(start, end).toMinutes() < 5) {
            throw new BusinessRuleException("A slot must be at least 5 minutes long");
        }
    }

    /** A doctor may only touch their own schedule; front desk / admin may touch anyone's. */
    private void requireOwnership(DoctorAvailability slot, User actor) {
        if (actor.getRole() == com.medcare.common.domain.UserRole.DOCTOR
                && !slot.getDoctor().getId().equals(actor.getId())) {
            throw new AccessDeniedException("You can only manage your own schedule");
        }
    }
}
