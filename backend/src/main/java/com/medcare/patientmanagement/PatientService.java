package com.medcare.patientmanagement;

import com.medcare.accesscontrol.AccountService;
import com.medcare.accesscontrol.UserRepository;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.form.UserForm;
import com.medcare.feedback.NotificationService;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientForm;
import com.medcare.patientmanagement.PatientRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 01 - Patient Management.
 *
 * <p><b>Abstraction.</b> Registration rules, search and the "delete or
 * deactivate?" decision are all kept here - the JSP / REST layer only calls
 * these methods and never validates or stores anything itself.</p>
 *
 * <p><b>Inheritance reuse.</b> Account creation is delegated to
 * {@link AccountService} with the {@link PatientForm} that extends
 * {@code UserForm}, so patient accounts share exactly the same rules as doctor
 * and staff accounts.</p>
 */
@Service
public class PatientService {

    private static final List<Appointment.Status> HISTORY_STATUSES =
            List.of(Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW);
    private static final List<Appointment.Status> OPEN_STATUSES =
            List.of(Appointment.Status.PENDING, Appointment.Status.CONFIRMED);

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final AccountService accountService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;
    private final NotificationService notificationService;

    public PatientService(PatientRepository patientRepository,
                          UserRepository userRepository,
                          AppointmentRepository appointmentRepository,
                          AccountService accountService,
                          DataExportService exportService,
                          AuditLogService auditLog,
                          NotificationService notificationService) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.accountService = accountService;
        this.exportService = exportService;
        this.auditLog = auditLog;
        this.notificationService = notificationService;
    }

    // ------------------------------------------------------------------
    //  CREATE - register a new patient
    // ------------------------------------------------------------------

    @Transactional
    public Patient register(PatientForm form, User actor) {
        validatePatient(form);
        accountService.ensureUsernameAvailable(form.getUsername(), null);

        Patient patient = new Patient();
        form.applyTo(patient);                                    // shared UserForm part + patient part
        accountService.applyPassword(patient, form.getPassword(), true);

        Patient saved = patientRepository.save(patient);
        exportService.refreshPatients();
        exportService.refreshSummary();
        auditLog.record(1, "CREATE", actor, "Registered patient #" + saved.getId() + " - " + saved.getFullName()
                + " (username " + saved.getUsername() + ")");
        notificationService.notifyAccountChange(saved, "Welcome to MedCare",
                "Your patient account has been created. You can now book appointments online.");
        return saved;
    }

    /**
     * Opens a patient record for a walk-in while the receptionist books the
     * appointment - the fastest path a busy front desk needs.
     *
     * <p>The receptionist only supplies what the patient can tell them at the
     * counter (name, telephone number, gender, town). The service invents a
     * unique username and a one-time password, so the rules about unique
     * usernames and password length are still applied in exactly one place, and
     * the rest of the record (address, date of birth, blood group, emergency
     * contact) can be completed later from the patient's profile page.</p>
     *
     * @return the saved patient, ready to be attached to an appointment
     */
    @Transactional
    public Patient registerWalkIn(String fullName, String phone, String gender, String city, User actor) {
        if (fullName == null || fullName.isBlank()) {
            throw new BusinessRuleException("Please enter the new patient's full name");
        }
        String digits = phone == null ? "" : phone.replaceAll("[^0-9]", "");

        PatientForm form = new PatientForm();
        form.setFullName(fullName.trim());
        form.setPhone(phone);
        form.setGender(gender);
        form.setCity(city);
        form.setUsername(uniqueUsername(fullName, digits));
        form.setPassword(initialPassword(digits));
        form.setActive(Boolean.TRUE);

        Patient saved = register(form, actor);
        auditLog.record(1, "CREATE", actor, "Walk-in patient #" + saved.getId() + " - " + saved.getFullName()
                + " registered at the counter (username " + saved.getUsername() + ", one-time password)");
        return saved;
    }

    /** Builds a username that is not taken: firstname + lastname, then numbered. */
    private String uniqueUsername(String fullName, String digits) {
        String base = fullName.trim().toLowerCase().replaceAll("[^a-z ]", "");
        String[] parts = base.split("\\s+");
        String candidate = parts.length > 1 ? parts[0] + "." + parts[parts.length - 1] : parts[0];
        if (candidate.length() < 4) {
            candidate = (candidate + (digits.isEmpty() ? "user" : digits)).substring(0, Math.min(12, candidate.length() + 4));
        }
        String attempt = candidate;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(attempt)) {
            attempt = candidate + (++suffix);
        }
        return attempt;
    }

    /** A one-time password the counter hands to the patient to change at first sign-in. */
    private String initialPassword(String digits) {
        String tail = digits.length() >= 4 ? digits.substring(digits.length() - 4) : String.format("%04d",
                Math.abs(System.nanoTime() % 10000));
        return "Med" + tail + "!";
    }

    // ------------------------------------------------------------------
    //  READ - list, search, view profile
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Patient> search(String keyword, String status) {
        return patientRepository.search(blankToNull(keyword), blankToNull(status));
    }

    @Transactional(readOnly = true)
    public List<Patient> findActive() {
        return patientRepository.search(null, "ACTIVE");
    }

    @Transactional(readOnly = true)
    public Patient getRequired(Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Patient", id));
    }

    @Transactional(readOnly = true)
    public long totalPatients() {
        return patientRepository.count();
    }

    // ------------------------------------------------------------------
    //  UPDATE - profile, contact, emergency contact, account status
    // ------------------------------------------------------------------

    @Transactional
    public Patient update(Long id, PatientForm form, User actor) {
        Patient patient = getRequired(id);
        accountService.ensureUsernameAvailable(form.getUsername(), patient.getId());

        String before = patient.getProfileSummary();
        form.applyTo(patient);
        if (form.getPassword() != null && !form.getPassword().isBlank()) {
            accountService.applyPassword(patient, form.getPassword(), true);
        }

        Patient saved = patientRepository.save(patient);
        exportService.refreshPatients();
        exportService.refreshSummary();
        auditLog.record(1, "UPDATE", actor, "Updated patient #" + saved.getId() + " - " + saved.getFullName()
                + " (was: " + before + ") -> now: " + saved.getProfileSummary());
        return saved;
    }

    /** Self-service profile update used by the Patient Profile Update page. */
    @Transactional
    public Patient updateOwnProfile(Long patientId, PatientForm form, User actor) {
        if (!patientId.equals(actor.getId())) {
            throw new com.medcare.common.exception.AccessDeniedException("You may only update your own profile");
        }
        // A patient cannot change their own account status or username.
        form.setUsername(actor.getUsername());
        form.setActive(true);
        return update(patientId, form, actor);
    }

    /** Account-status toggle (Update operation, staff only). */
    @Transactional
    public Patient setActive(Long id, boolean active, User actor) {
        Patient patient = getRequired(id);
        patient.applyActiveFlag(active);
        Patient saved = patientRepository.save(patient);
        exportService.refreshPatients();
        exportService.refreshSummary();
        auditLog.record(1, active ? "ACTIVATE" : "DEACTIVATE", actor,
                "Patient #" + saved.getId() + " - " + saved.getFullName() + " account status set to "
                        + saved.getStatusLabel());
        notificationService.notifyAccountChange(saved, active ? "Account reactivated" : "Account deactivated",
                active ? "Your account is active again. You can book appointments."
                       : "Your account has been deactivated by the clinic.");
        return saved;
    }

    // ------------------------------------------------------------------
    //  DELETE - remove test records, deactivate real accounts
    // ------------------------------------------------------------------

    @Transactional
    public String deleteOrDeactivate(Long id, User actor) {
        Patient patient = getRequired(id);
        boolean hasHistory = appointmentRepository.existsByPatientIdAndStatusIn(id, HISTORY_STATUSES);
        boolean hasOpen = appointmentRepository.existsByPatientIdAndStatusIn(id, OPEN_STATUSES);

        if (hasOpen) {
            throw new BusinessRuleException("This patient still has pending/confirmed appointments. "
                    + "Cancel or reschedule them first, then deactivate the account.");
        }

        // Rule from the specification: real accounts with history are deactivated,
        // only unused test records may be removed permanently.
        if (hasHistory) {
            patient.deactivate();
            patientRepository.save(patient);
            exportService.refreshPatients();
            exportService.refreshSummary();
            auditLog.record(1, "DEACTIVATE", actor, "Patient #" + id + " - " + patient.getFullName()
                    + " deactivated (appointment history preserved)");
            notificationService.notifyAccountChange(patient, "Account deactivated",
                    "Your account was deactivated. Existing appointment history has been preserved.");
            return "Patient has appointment history, so the account was DEACTIVATED instead of deleted. "
                    + "The appointment records are preserved.";
        }

        auditLog.record(1, "DELETE", actor, "Patient #" + id + " - " + patient.getFullName()
                + " deleted (unused test record, no appointment history)");
        patientRepository.delete(patient);
        exportService.refreshPatients();
        exportService.refreshSummary();
        return "Unused patient test record deleted from the system.";
    }

    private void validatePatient(PatientForm form) {
        if (form.getDateOfBirth() != null && form.getDateOfBirth().isAfter(LocalDate.now())) {
            throw new BusinessRuleException("Date of birth cannot be in the future");
        }
        if (form.getDateOfBirth() != null && form.getDateOfBirth().isBefore(LocalDate.now().minusYears(130))) {
            throw new BusinessRuleException("Please check the date of birth");
        }
        if ((form.getEmergencyContactName() == null) != (form.getEmergencyContactPhone() == null)) {
            throw new BusinessRuleException("Please provide both the emergency contact name and phone number");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
