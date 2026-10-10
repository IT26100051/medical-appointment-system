package com.medcare.doctormanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.form.UserForm;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorForm;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.feedback.NotificationService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 02 - Doctor Management.
 *
 * <p>Registration, search and status rules for doctors. Uses the shared
 * {@link AccountService} through the inherited {@code UserForm} fields, which is
 * exactly the polymorphism the specification asks for.</p>
 */
@Service
public class DoctorService {

    private static final List<Appointment.Status> OPEN_STATUSES =
            List.of(Appointment.Status.PENDING, Appointment.Status.CONFIRMED);
    private static final List<Appointment.Status> HISTORY_STATUSES =
            List.of(Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW);

    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final AccountService accountService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;
    private final NotificationService notificationService;

    public DoctorService(DoctorRepository doctorRepository,
                         AppointmentRepository appointmentRepository,
                         DoctorAvailabilityRepository availabilityRepository,
                         AccountService accountService,
                         DataExportService exportService,
                         AuditLogService auditLog,
                         NotificationService notificationService) {
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.availabilityRepository = availabilityRepository;
        this.accountService = accountService;
        this.exportService = exportService;
        this.auditLog = auditLog;
        this.notificationService = notificationService;
    }

    // ---------------- CREATE ----------------

    @Transactional
    public Doctor register(DoctorForm form, User actor) {
        accountService.ensureUsernameAvailable(form.getUsername(), null);
        Doctor doctor = new Doctor();
        form.applyTo(doctor);                       // patient/doctor/staff share this step
        accountService.applyPassword(doctor, form.getPassword(), true);

        Doctor saved = doctorRepository.save(doctor);
        exportService.refreshDoctors();
        exportService.refreshSummary();
        auditLog.record(2, "CREATE", actor, "Registered doctor #" + saved.getId() + " - Dr. " + saved.getFullName()
                + " | " + saved.getSpecialization() + " | " + saved.getConsultationMinutes()
                + " min consultation");
        notificationService.notifyAccountChange(saved, "Account created",
                "Welcome Dr. " + saved.getFullName() + ". Your profile has been added to the scheduling system.");
        return saved;
    }

    // ---------------- READ ----------------

    @Transactional(readOnly = true)
    public List<Doctor> search(String keyword, String specialization, String status) {
        return doctorRepository.search(blankToNull(keyword), blankToNull(specialization), blankToNull(status));
    }

    @Transactional(readOnly = true)
    public List<Doctor> findActive() {
        return doctorRepository.findByActiveTrueOrderByFullNameAsc();
    }

    @Transactional(readOnly = true)
    public List<String> specializations() {
        return doctorRepository.findDistinctSpecializations();
    }

    @Transactional(readOnly = true)
    public Doctor getRequired(Long id) {
        return doctorRepository.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Doctor", id));
    }

    @Transactional(readOnly = true)
    public long totalDoctors() {
        return doctorRepository.count();
    }

    // ---------------- UPDATE ----------------

    @Transactional
    public Doctor update(Long id, DoctorForm form, User actor) {
        Doctor doctor = getRequired(id);
        accountService.ensureUsernameAvailable(form.getUsername(), doctor.getId());
        String before = doctor.getProfileSummary();

        form.applyTo(doctor);
        if (form.getPassword() != null && !form.getPassword().isBlank()) {
            accountService.applyPassword(doctor, form.getPassword(), true);
        }

        Doctor saved = doctorRepository.save(doctor);
        exportService.refreshDoctors();
        exportService.refreshSummary();
        auditLog.record(2, "UPDATE", actor, "Updated doctor #" + saved.getId() + " - Dr. " + saved.getFullName()
                + " (was: " + before + ") -> now: " + saved.getProfileSummary());
        return saved;
    }

    /** A doctor may edit their own professional profile but not their own status. */
    @Transactional
    public Doctor updateOwnProfile(Long doctorId, DoctorForm form, User actor) {
        if (!doctorId.equals(actor.getId())) {
            throw new com.medcare.common.exception.AccessDeniedException("You may only update your own profile");
        }
        form.setUsername(actor.getUsername());
        form.setActive(true);
        return update(doctorId, form, actor);
    }

    @Transactional
    public Doctor setActive(Long id, boolean active, User actor) {
        Doctor doctor = getRequired(id);
        if (!active && appointmentRepository.existsByDoctorIdAndStatusIn(id, OPEN_STATUSES)) {
            throw new BusinessRuleException("This doctor has pending/confirmed appointments. "
                    + "Reassign or cancel them before deactivating the account.");
        }
        doctor.applyActiveFlag(active);
        if (!active) {
            blockAllFutureSlots(doctor, actor);
        }
        Doctor saved = doctorRepository.save(doctor);
        exportService.refreshDoctors();
        exportService.refreshSchedules();
        exportService.refreshSummary();
        auditLog.record(2, active ? "ACTIVATE" : "DEACTIVATE", actor,
                "Doctor #" + saved.getId() + " - Dr. " + saved.getFullName() + " set to " + saved.getStatusLabel());
        notificationService.notifyAccountChange(saved, active ? "Account reactivated" : "Account deactivated",
                active ? "Your account is active again." : "Your account has been deactivated by the administrator.");
        return saved;
    }

    private void blockAllFutureSlots(Doctor doctor, User actor) {
        availabilityRepository.findAll().stream()
                .filter(s -> s.getDoctor().getId().equals(doctor.getId()))
                .filter(s -> s.isAvailableForBooking())
                .forEach(s -> s.block("Doctor account deactivated"));
    }

    // ---------------- DELETE ----------------

    @Transactional
    public String deleteOrDeactivate(Long id, User actor) {
        Doctor doctor = getRequired(id);
        boolean hasOpen = appointmentRepository.existsByDoctorIdAndStatusIn(id, OPEN_STATUSES);
        boolean hasHistory = appointmentRepository.existsByDoctorIdAndStatusIn(id, HISTORY_STATUSES);

        if (hasOpen) {
            throw new BusinessRuleException("This doctor has pending/confirmed appointments. "
                    + "Cancel or reassign them first.");
        }

        // Appointments reference the doctor, so a doctor with any history must be
        // deactivated - only doctors who were never used can be deleted.
        if (hasHistory) {
            doctor.deactivate();
            doctorRepository.save(doctor);
            blockAllFutureSlots(doctor, actor);
            exportService.refreshDoctors();
            exportService.refreshSchedules();
            exportService.refreshSummary();
            auditLog.record(2, "DEACTIVATE", actor, "Doctor #" + id + " - Dr. " + doctor.getFullName()
                    + " deactivated (appointment history preserved, future slots blocked)");
            return "Doctor has appointment history, so the account was DEACTIVATED instead of deleted. "
                    + "Existing appointments and feedback are preserved.";
        }

        deleteUnusedSlots(id);
        auditLog.record(2, "DELETE", actor, "Doctor #" + id + " - Dr. " + doctor.getFullName()
                + " deleted (unused test record, no appointment history)");
        doctorRepository.delete(doctor);
        exportService.refreshDoctors();
        exportService.refreshSchedules();
        exportService.refreshSummary();
        return "Unused doctor test record and its availability slots were deleted from the system.";
    }

    /** Removes the doctor's slots - only ever called when there are no appointments. */
    private void deleteUnusedSlots(Long doctorId) {
        availabilityRepository.findAll().stream()
                .filter(s -> s.getDoctor().getId().equals(doctorId))
                .forEach(availabilityRepository::delete);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
