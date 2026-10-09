package com.medcare.common.config;

import com.medcare.accesscontrol.Staff;
import com.medcare.accesscontrol.StaffForm;
import com.medcare.accesscontrol.StaffService;
import com.medcare.accesscontrol.UserRepository;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentForm;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.appointmentmanagement.AppointmentService;
import com.medcare.availability.AvailabilityForm;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.availability.ScheduleService;
import com.medcare.common.audit.AuditLogService;
import com.medcare.common.documents.DataExportService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.PasswordUtil;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorForm;
import com.medcare.doctormanagement.DoctorService;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.FeedbackForm;
import com.medcare.feedback.FeedbackService;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientForm;
import com.medcare.patientmanagement.PatientService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Loads a realistic demonstration data set the first time the application runs.
 *
 * <p>All records are created through the ordinary service layer (or, for
 * historical appointments, through the domain objects' own lifecycle methods),
 * so the demonstration data obeys exactly the same rules as data entered by
 * hand through the web pages.</p>
 */
@Component
public class DemoDataSeeder implements CommandLineRunner {

    private final boolean enabled;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final StaffService staffService;
    private final DoctorService doctorService;
    private final PatientService patientService;
    private final ScheduleService scheduleService;
    private final AppointmentService appointmentService;
    private final FeedbackService feedbackService;
    private final DataExportService exportService;
    private final AuditLogService auditLog;
    private final com.medcare.appointmentmanagement.WaitlistService waitlistService;

    public DemoDataSeeder(@Value("${app.seed.demo-data:true}") boolean enabled,
                          UserRepository userRepository,
                          AppointmentRepository appointmentRepository,
                          DoctorAvailabilityRepository availabilityRepository,
                          StaffService staffService,
                          DoctorService doctorService,
                          PatientService patientService,
                          ScheduleService scheduleService,
                          AppointmentService appointmentService,
                          FeedbackService feedbackService,
                          DataExportService exportService,
                          AuditLogService auditLog,
                          com.medcare.appointmentmanagement.WaitlistService waitlistService) {
        this.enabled = enabled;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.availabilityRepository = availabilityRepository;
        this.staffService = staffService;
        this.doctorService = doctorService;
        this.patientService = patientService;
        this.scheduleService = scheduleService;
        this.appointmentService = appointmentService;
        this.feedbackService = feedbackService;
        this.exportService = exportService;
        this.auditLog = auditLog;
        this.waitlistService = waitlistService;
    }

    @Override
    public void run(String... args) {
        if (enabled && userRepository.count() == 0) {
            seed();
        }
        exportService.refreshAll();
    }

    private void seed() {
        System.out.println("[seed] Loading demonstration data (disable with app.seed.demo-data=false)...");

        Staff admin = createStaff("admin", "admin123", "System Administrator", UserRole.ADMIN,
                "Chief Administrator", "EMP-001", "Office 1");
        createStaff("reception", "reception123", "Kumari Jayasuriya", UserRole.RECEPTIONIST,
                "Front Desk Officer", "EMP-002", "Counter 1");
        createStaff("nurse", "nurse123", "Sanduni Alwis", UserRole.RECEPTIONIST,
                "Duty Nurse", "EMP-003", "Counter 2");

        List<Doctor> doctors = new ArrayList<>();
        doctors.add(createDoctor("drsilva", "Anura Silva", "Cardiologist",
                "MBBS, MD (Cardiology)", "SLMC-10231", 30, 4500.00, "Room 12"));
        doctors.add(createDoctor("drfernando", "Ruvini Fernando", "Dermatologist",
                "MBBS, MD (Dermatology)", "SLMC-10455", 20, 3500.00, "Room 08"));
        doctors.add(createDoctor("drperera", "Lakmal Perera", "General Physician",
                "MBBS, DFM", "SLMC-11002", 15, 2500.00, "Room 03"));
        doctors.add(createDoctor("drnawaz", "Aisha Nawaz", "Paediatrician",
                "MBBS, DCH, MD (Paediatrics)", "SLMC-10877", 25, 4000.00, "Room 21"));

        List<Patient> patients = new ArrayList<>();
        patients.add(createPatient("nimasha", "Nimasha Perera", "nimasha.perera@example.com", "+94 71 234 5678",
                LocalDate.of(1994, 4, 12), "Female", "947654321V", "22/A, Temple Road", "Ratnapura",
                "O+", "Nimal Perera", "+94 77 555 1122", "Mild hypertension"));
        patients.add(createPatient("kasun95", "Kasun Bandara", "kasun.bandara@example.com", "+94 76 998 7766",
                LocalDate.of(1988, 11, 3), "Male", "881122334V", "15, Main Street", "Kandy",
                "A+", "Dilini Bandara", "+94 76 111 2233", null));
        patients.add(createPatient("thilini", "Thilini Wickramasinghe", "thilini.w@example.com", "+94 70 445 6677",
                LocalDate.of(2001, 6, 25), "Female", "2001456789", "88, Lake View", "Colombo",
                "B+", "Saman Wickramasinghe", "+94 70 445 6600", "Penicillin allergy"));
        patients.add(createPatient("arun99", "Arun Kumar", "arun.kumar@example.com", "+94 75 223 8899",
                LocalDate.of(1979, 2, 17), "Male", "791234567V", "4, Beach Road", "Galle",
                "AB-", "Priya Kumar", "+94 75 223 8800", "Type 2 diabetes"));
        patients.add(createPatient("maleesha", "Maleesha Fernando", "maleesha.f@example.com", "+94 78 334 5566",
                LocalDate.of(2015, 9, 8), "Female", "2015456789", "110, Hill Street", "Negombo",
                "O-", "Ruwan Fernando", "+94 78 334 5500", "Asthma - uses inhaler"));
        patients.add(createPatient("suresh77", "Suresh Rajapaksa", "suresh.r@example.com", "+94 77 667 8899",
                LocalDate.of(1965, 12, 30), "Male", "652345678V", "3, River Side", "Matara",
                "A-", "Kanthi Rajapaksa", "+94 77 667 8800", "High cholesterol"));

        // ---- Availability: next working days, every consultation slot ----------
        int dayCount = 0;
        for (int offset = 1; offset <= 9 && dayCount < 5; offset++) {
            LocalDate date = LocalDate.now().plusDays(offset);
            if (date.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            dayCount++;
            for (Doctor doctor : doctors) {
                AvailabilityForm form = new AvailabilityForm();
                form.setDoctorId(doctor.getId());
                form.setSlotDate(date);
                form.setStartTime(LocalTime.of(9, 0));
                form.setEndTime(LocalTime.of(12, 0));
                form.setRepeat(true);
                form.setRemarks("Standard clinic session");
                scheduleService.create(form, admin);
                if (doctor.getSpecialization().contains("Cardio") || doctor.getSpecialization().contains("Paed")) {
                    AvailabilityForm evening = new AvailabilityForm();
                    evening.setDoctorId(doctor.getId());
                    evening.setSlotDate(date);
                    evening.setStartTime(LocalTime.of(16, 0));
                    evening.setEndTime(LocalTime.of(18, 0));
                    evening.setRepeat(true);
                    scheduleService.create(evening, admin);
                }
            }
        }

        // ---- Future appointments ---------------------------------------------
        Appointment pending = createFutureAppointment(admin, patients.get(0), doctors.get(0),
                "Chest tightness during exercise", false);
        Appointment pendingTwo = createFutureAppointment(admin, patients.get(1), doctors.get(2),
                "Persistent cough for two weeks", false);
        Appointment confirmed = createFutureAppointment(admin, patients.get(4), doctors.get(3),
                "Fever and ear pain", true);
        Appointment confirmedTwo = createFutureAppointment(admin, patients.get(2), doctors.get(1),
                "Skin rash on both arms", true);
        createFutureAppointment(admin, patients.get(3), doctors.get(0), "Follow-up: blood pressure review", false);

        // ---- Historical appointments (kept as history) ------------------------
        Appointment completedOne = createHistoricalAppointment(patients.get(0), doctors.get(0), 7,
                LocalTime.of(9, 30), "Follow-up consultation", true, null);
        Appointment completedTwo = createHistoricalAppointment(patients.get(1), doctors.get(2), 5,
                LocalTime.of(10, 15), "Fever and body ache", true, null);
        Appointment completedThree = createHistoricalAppointment(patients.get(2), doctors.get(1), 3,
                LocalTime.of(11, 0), "Acne treatment review", true, null);
        createHistoricalAppointment(patients.get(5), doctors.get(0), 10,
                LocalTime.of(9, 0), "Routine cardiac screening", false, "Patient rescheduled to a later date");
        createHistoricalAppointment(patients.get(3), doctors.get(3), 14,
                LocalTime.of(16, 30), "Child vaccination enquiry", false, "Doctor had an emergency surgery");

        // ---- Today's clinic: a live waiting room to look at -------------------
        seedTodaysClinic(patients, doctors, admin);

        // ---- Feedback on completed consultations ------------------------------
        submitFeedback(patients.get(0), completedOne, 5,
                "Dr. Silva explained everything clearly and the clinic was very organised. Highly recommended.");
        submitFeedback(patients.get(1), completedTwo, 4,
                "Good consultation, waiting time was a little long but the treatment worked well.");
        submitFeedback(patients.get(2), completedThree, 5,
                "Very friendly doctor and the online booking saved me a lot of time at the counter.");

        // ---- The waiting list: two patients hoping for an earlier time --------
        seedWaitingList(patients, doctors, admin);

        auditLog.record(0, "SEED", admin, "Demonstration data loaded: 4 doctors, 6 patients, 3 staff accounts, "
                + availabilityRepository.count() + " availability slots, " + appointmentRepository.count()
                + " appointments (including cancelled history), 3 feedback entries");

        System.out.println("[seed] Demonstration data ready. Log in with admin/admin123, "
                + "reception/reception123, drsilva/doctor123 or nimasha/patient123");
        System.out.println("[seed] Text documents written to the ./documents folder");
        System.out.println("[seed] Reference records: pending=" + pending.getReferenceNo()
                + ", confirmed=" + confirmed.getReferenceNo() + " -> " + confirmed.getPatient().getFullName()
                + ", cancelled history=" + completedThree.getPatient().getFullName());
    }

    /**
     * Photograph of every demonstration person, stored in
     * {@code frontend/img/people}. Real clinics take a picture when a patient or
     * a doctor is registered, which is what this table stands in for.
     */
    private static final java.util.Map<String, String> PHOTOS = java.util.Map.ofEntries(
            java.util.Map.entry("admin", "staff-admin.jpg"),
            java.util.Map.entry("reception", "staff-kumari.jpg"),
            java.util.Map.entry("nurse", "staff-sanduni.jpg"),
            java.util.Map.entry("drsilva", "doctor-silva.jpg"),
            java.util.Map.entry("drfernando", "doctor-fernando.jpg"),
            java.util.Map.entry("drperera", "doctor-perera.jpg"),
            java.util.Map.entry("drnawaz", "doctor-nawaz.jpg"),
            java.util.Map.entry("nimasha", "patient-nimasha.jpg"),
            java.util.Map.entry("kasun95", "patient-kasun.jpg"),
            java.util.Map.entry("thilini", "patient-thilini.jpg"),
            java.util.Map.entry("arun99", "patient-arun.jpg"),
            java.util.Map.entry("maleesha", "patient-maleesha.jpg"),
            java.util.Map.entry("suresh77", "patient-suresh.jpg"));

    // ------------------------------------------------------------------
    //  Helpers
    // ------------------------------------------------------------------

    private Staff createStaff(String username, String password, String fullName, UserRole role,
                              String designation, String employeeCode, String counter) {
        StaffForm form = new StaffForm();
        form.setUsername(username);
        form.setPassword(password);
        form.setFullName(fullName);
        form.setRole(role);
        form.setDesignation(designation);
        form.setEmployeeCode(employeeCode);
        form.setCounterNo(counter);
        form.setPhoto(PHOTOS.get(username));
        form.setActive(true);
        User actor = userRepository.findByUsernameIgnoreCase("admin").orElse(null);
        if (actor == null) {
            // First account (the administrator itself) is created directly so that
            // the remaining accounts can be created through the normal service path.
            Staff staff = new Staff(username, PasswordUtil.hash(password), fullName, role);
            staff.updateStaffDetails(designation, employeeCode, counter, role);
            staff.changePhoto(PHOTOS.get(username));
            return userRepository.save(staff);
        }
        return staffService.register(form, actor);
    }

    private Doctor createDoctor(String username, String fullName, String specialization, String qualifications,
                                String registrationNo, int minutes, double fee, String room) {
        DoctorForm form = new DoctorForm();
        form.setUsername(username);
        form.setPassword("doctor123");
        form.setFullName(fullName);
        form.setSpecialization(specialization);
        form.setQualifications(qualifications);
        form.setRegistrationNo(registrationNo);
        form.setConsultationMinutes(minutes);
        form.setConsultationFee(fee);
        form.setRoomNo(room);
        form.setPhoto(PHOTOS.get(username));
        form.setEmail(username + "@medcare.lk");
        form.setPhone("+94 11 234 5" + (100 + minutes));
        form.setActive(true);
        return doctorService.register(form, admin());
    }

    private Patient createPatient(String username, String fullName, String email, String phone,
                                  LocalDate dob, String gender, String nic, String address, String city,
                                  String bloodGroup, String emergencyName, String emergencyPhone,
                                  String notes) {
        PatientForm form = new PatientForm();
        form.setUsername(username);
        form.setPassword("patient123");
        form.setFullName(fullName);
        form.setEmail(email);
        form.setPhone(phone);
        form.setDateOfBirth(dob);
        form.setGender(gender);
        form.setNic(nic);
        form.setAddress(address);
        form.setCity(city);
        form.setBloodGroup(bloodGroup);
        form.setEmergencyContactName(emergencyName);
        form.setEmergencyContactPhone(emergencyPhone);
        form.setMedicalNotes(notes);
        form.setPhoto(PHOTOS.get(username));
        form.setActive(true);
        return patientService.register(form, admin());
    }

    /**
     * Opens today's clinic so the waiting room shows a real, live day: one
     * patient has already been seen earlier today, and two more are booked into
     * the session that is about to start, so they are in the waiting room with a
     * token each.
     *
     * <p>Nothing is created when the clinic day is already over - an evening
     * start then simply shows an empty waiting room, which is the truth.</p>
     */
    /**
     * Two places on the waiting list, the way a real reception keeps them: a
     * patient who can only come in the morning is waiting for the cardiologist,
     * and a parent is waiting for the paediatrician after school hours.
     */
    private void seedWaitingList(List<Patient> patients, List<Doctor> doctors, User actor) {
        LocalDate today = LocalDate.now();
        List<com.medcare.appointmentmanagement.WaitlistForm> wishes = new java.util.ArrayList<>();

        com.medcare.appointmentmanagement.WaitlistForm first = new com.medcare.appointmentmanagement.WaitlistForm();
        first.setPatientId(patients.get(2).getId());
        first.setDoctorId(doctors.get(0).getId());
        first.setPreferredFrom(today.plusDays(1));
        first.setPreferredTo(today.plusDays(10));
        first.setNote("Can only come before noon - I work afternoons");
        wishes.add(first);

        com.medcare.appointmentmanagement.WaitlistForm second = new com.medcare.appointmentmanagement.WaitlistForm();
        second.setPatientId(patients.get(4).getId());
        second.setDoctorId(doctors.get(3).getId());
        second.setPreferredFrom(today.plusDays(2));
        second.setNote("After school hours, please - bringing my daughter");
        wishes.add(second);

        for (var wish : wishes) {
            try {
                waitlistService.join(actor, wish);
            } catch (RuntimeException ignored) {
                /* an entry already exists - the demonstration data is simply loaded once */
            }
        }
    }

    private void seedTodaysClinic(List<Patient> patients, List<Doctor> doctors, User actor) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        if (now.isAfter(LocalTime.of(9, 0)) && now.isBefore(LocalTime.of(23, 0))) {
            LocalTime seenAt = now.minusHours(2).withMinute(0).withSecond(0).withNano(0);
            Appointment seen = createHistoricalAppointment(patients.get(4), doctors.get(3), 0, seenAt,
                    "Ear pain and mild fever", false, null);
            appointmentService.complete(seen.getId(),
                    "Left ear looks inflamed, no fever at the time of the visit.",
                    "Ear infection in the left ear. No fever at the time of the visit.",
                    today.plusDays(7),
                    "Keep the ear dry and finish the full course of antibiotics.", actor);
        }

        if (now.isAfter(LocalTime.of(17, 30))) {
            return;
        }
        LocalTime start = now.plusMinutes(30).withSecond(0).withNano(0);
        int minutes = start.getMinute();
        if (minutes % 15 != 0) {
            start = start.plusMinutes(15 - (minutes % 15));
        }

        for (int index = 0; index < 2; index++) {
            Doctor doctor = doctors.get(index == 0 ? 0 : 2);
            DoctorAvailability slot = new DoctorAvailability(doctor, today, start, start.plusMinutes(
                    doctor.getConsultationMinutes() == null ? 30 : doctor.getConsultationMinutes()));
            availabilityRepository.save(slot);

            Appointment waiting = appointmentService.book(appointmentForm(patients.get(index == 0 ? 5 : 1),
                    doctor, slot, index == 0 ? "Chest pain review" : "Persistent cough review"), actor);
            if (index == 1) {
                appointmentService.changePriority(waiting.getId(), "URGENT", actor);
            }
        }
    }

    private AppointmentForm appointmentForm(Patient patient, Doctor doctor, DoctorAvailability slot,
                                            String reason) {
        AppointmentForm form = new AppointmentForm();
        form.setPatientId(patient.getId());
        form.setDoctorId(doctor.getId());
        form.setSlotId(slot.getId());
        form.setReason(reason);
        return form;
    }

    private Appointment createFutureAppointment(User actor, Patient patient, Doctor doctor,
                                                String reason, boolean confirm) {
        DoctorAvailability slot = availabilityRepository.findOpenSlots(doctor.getId(), LocalDate.now())
                .stream().findFirst().orElseThrow(() -> new IllegalStateException("no slot available"));
        AppointmentForm form = new AppointmentForm();
        form.setPatientId(patient.getId());
        form.setDoctorId(doctor.getId());
        form.setSlotId(slot.getId());
        form.setReason(reason);
        Appointment appointment = appointmentService.book(form, actor);
        if (confirm) {
            appointmentService.confirm(appointment.getId(), actor);
        }
        return appointment;
    }

    /**
     * Historical appointment placed directly on the timeline, then moved through
     * the entity's own lifecycle methods - exactly like a live appointment.
     */
    private int historySequence = 0;

    private Appointment createHistoricalAppointment(Patient patient, Doctor doctor, int daysAgo,
                                                    LocalTime start, String reason, boolean complete,
                                                    String cancellationReason) {
        LocalDate date = LocalDate.now().minusDays(daysAgo);
        DoctorAvailability slot = new DoctorAvailability(doctor, date, start,
                start.plusMinutes(doctor.getConsultationMinutes() == null ? 30 : doctor.getConsultationMinutes()));
        slot.markBooked();
        availabilityRepository.save(slot);

        Appointment appointment = new Appointment(
                "APT-" + date.toString().replace("-", "") + "-H" + String.format("%02d", ++historySequence),
                patient, doctor, slot, date, slot.getStartTime(), slot.getEndTime(), reason, "seed data");
        appointment.confirm("seed");
        if (cancellationReason != null) {
            appointment.cancel(cancellationReason, "seed data");
        } else if (complete) {
            appointment.complete("seed");
        }
        return appointmentRepository.save(appointment);
    }

    private void submitFeedback(Patient patient, Appointment appointment, int rating, String comments) {
        FeedbackForm form = new FeedbackForm();
        form.setAppointmentId(appointment.getId());
        form.setRating(rating);
        form.setComments(comments);
        feedbackService.submit(form, patient);
    }

    private User admin() {
        return userRepository.findByUsernameIgnoreCase("admin").orElseThrow();
    }
}
