package com.medcare;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.medcare.accesscontrol.Staff;
import com.medcare.accesscontrol.StaffService;
import com.medcare.accesscontrol.UserRepository;
import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentForm;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.appointmentmanagement.AppointmentService;
import com.medcare.appointmentmanagement.WaitlistEntry;
import com.medcare.appointmentmanagement.WaitlistForm;
import com.medcare.appointmentmanagement.WaitlistRepository;
import com.medcare.appointmentmanagement.WaitlistService;
import com.medcare.availability.AvailabilityForm;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.availability.ScheduleService;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.security.PasswordUtil;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorForm;
import com.medcare.doctormanagement.DoctorService;
import com.medcare.feedback.FeedbackForm;
import com.medcare.feedback.FeedbackService;
import com.medcare.patientmanagement.Patient;
import com.medcare.patientmanagement.PatientForm;
import com.medcare.patientmanagement.PatientService;

/**
 * Rule tests for the appointment side of the system: who may cancel, who may
 * complete or reopen, and how the availability slots protect themselves.
 *
 * <p>These tests use their own in-memory database, so running them never touches
 * the demonstration data that is shown during the viva.</p>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:medcare-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.seed.demo-data=false",
        "app.output.dir=target/test-output"
})
class AppointmentRulesTest {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired private UserRepository userRepository;
    @Autowired private StaffService staffService;
    @Autowired private DoctorService doctorService;
    @Autowired private PatientService patientService;
    @Autowired private ScheduleService scheduleService;
    @Autowired private AppointmentService appointmentService;
    @Autowired private AppointmentRepository appointmentRepository;
    @Autowired private DoctorAvailabilityRepository availabilityRepository;
    @Autowired private FeedbackService feedbackService;
    @Autowired private WaitlistService waitlistService;
    @Autowired private WaitlistRepository waitlistRepository;

    private User admin;
    private Doctor doctor;

    @BeforeEach
    void setUp() {
        admin = ensureAdmin();
        doctor = doctorService.register(doctorForm(), admin);
    }

    // -------------------------------------------------------------- who may cancel

    @Test
    @DisplayName("A patient can cancel their own future appointment and the slot is released")
    void patientCanCancelOwnUpcomingAppointment() {
        Patient patient = createPatient();
        Appointment appointment = book(patient, futureSlot());

        Appointment cancelled = appointmentService.cancel(appointment.getId(),
                "I am unwell and cannot attend", patient);

        assertEquals(Appointment.Status.CANCELLED, cancelled.getStatus());
        assertEquals("I am unwell and cannot attend", cancelled.getCancellationReason());
        assertTrue(cancelled.getCancelledBy().contains("PATIENT"),
                "the record must show that the patient cancelled it");
        assertEquals("Available", cancelled.getSlot().getStatusLabel(),
                "cancelling must hand the time back to the clinic");
    }

    @Test
    @DisplayName("A patient cannot cancel an appointment that has already taken place")
    void patientCannotCancelPastAppointment() {
        Patient patient = createPatient();
        Appointment past = pastAppointment(patient);

        BusinessRuleException error = assertThrows(BusinessRuleException.class,
                () -> appointmentService.cancel(past.getId(), "Too late", patient));

        assertTrue(error.getMessage().contains("already taken place"));
        assertEquals(Appointment.Status.PENDING, appointmentRepository.findById(past.getId())
                .orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Clinic staff can still cancel a past record for administration")
    void staffCanCancelPastAppointment() {
        Patient patient = createPatient();
        Appointment past = pastAppointment(patient);

        Appointment cancelled = appointmentService.cancel(past.getId(),
                "Record corrected at the counter", admin);

        assertEquals(Appointment.Status.CANCELLED, cancelled.getStatus());
        assertTrue(cancelled.getCancelledBy().contains("ADMIN"));
    }

    @Test
    @DisplayName("A cancelled appointment stays in the history and can never move on again")
    void cancelledAppointmentStaysInHistory() {
        Patient patient = createPatient();
        Appointment appointment = book(patient, futureSlot());
        appointmentService.cancel(appointment.getId(), "Patient requested", admin);

        assertTrue(appointmentService.search(admin, null, null, "CANCELLED", null, null, null)
                        .stream().anyMatch(a -> a.getReferenceNo().equals(appointment.getReferenceNo())),
                "the cancelled appointment must still be listed");

        assertThrows(BusinessRuleException.class,
                () -> appointmentService.confirm(appointment.getId(), admin));
    }

    // -------------------------------------------------------- completing / reopening

    @Test
    @DisplayName("A completed appointment can be reopened while there is no feedback yet")
    void completedAppointmentCanBeReopenedUntilFeedbackExists() {
        Patient patient = createPatient();
        Appointment appointment = book(patient, futureSlot());
        appointmentService.confirm(appointment.getId(), admin);
        appointmentService.complete(appointment.getId(), "Consultation finished", admin);

        Appointment reopened = appointmentService.reopen(appointment.getId(), admin);
        assertEquals(Appointment.Status.CONFIRMED, reopened.getStatus());

        // once the patient has rated the visit, the completion stands
        appointmentService.complete(appointment.getId(), "Consultation finished", admin);
        FeedbackForm feedback = new FeedbackForm();
        feedback.setAppointmentId(appointment.getId());
        feedback.setRating(5);
        feedback.setComments("Very good consultation and a friendly team.");
        feedbackService.submit(feedback, patient);

        assertThrows(BusinessRuleException.class,
                () -> appointmentService.reopen(appointment.getId(), admin));
    }

    @Test
    @DisplayName("Only a completed appointment can be reopened")
    void onlyCompletedAppointmentsCanBeReopened() {
        Patient patient = createPatient();
        Appointment pending = book(patient, futureSlot());

        assertThrows(BusinessRuleException.class,
                () -> appointmentService.reopen(pending.getId(), admin));
    }

    // -------------------------------------------------------------- booking rules

    @Test
    @DisplayName("The same slot cannot be given to two patients")
    void doubleBookingIsRejected() {
        Patient first = createPatient();
        Patient second = createPatient();
        DoctorAvailability slot = futureSlot();
        book(first, slot);

        AppointmentForm clash = new AppointmentForm();
        clash.setPatientId(second.getId());
        clash.setDoctorId(doctor.getId());
        clash.setSlotId(slot.getId());
        clash.setReason("Second opinion");

        assertThrows(BusinessRuleException.class, () -> appointmentService.book(clash, admin));
        assertEquals("Booked", availabilityRepository.findById(slot.getId()).orElseThrow().getStatusLabel());
    }

    @Test
    @DisplayName("A patient books for themselves when the page does not name a record")
    void patientBooksForThemselves() {
        Patient patient = createPatient();
        DoctorAvailability slot = futureSlot();
        AppointmentForm form = new AppointmentForm();
        form.setDoctorId(doctor.getId());
        form.setSlotId(slot.getId());
        form.setReason("I keep getting headaches in the afternoon");

        Appointment appointment = appointmentService.book(form, patient);

        assertEquals(patient.getId(), appointment.getPatient().getId(),
                "the visit must be written in the signed-in patient's own name");
        assertEquals(Appointment.Status.PENDING, appointment.getStatus());
        assertEquals("Booked", availabilityRepository.findById(slot.getId()).orElseThrow().getStatusLabel());
    }

    @Test
    @DisplayName("A patient can never book an appointment in somebody else's name")
    void patientCannotBookForSomebodyElse() {
        Patient patient = createPatient();
        Patient somebodyElse = createPatient();
        DoctorAvailability slot = futureSlot();
        AppointmentForm form = new AppointmentForm();
        form.setPatientId(somebodyElse.getId());
        form.setDoctorId(doctor.getId());
        form.setSlotId(slot.getId());
        form.setReason("Not my record");

        assertThrows(AccessDeniedException.class, () -> appointmentService.book(form, patient));
        assertEquals("Available", availabilityRepository.findById(slot.getId()).orElseThrow().getStatusLabel(),
                "a refused booking must leave the time free for the patient who needs it");
    }

    // ------------------------------------------------------------- waiting list

    @Test
    @DisplayName("A patient joins the waiting list for a doctor, and cannot join twice")
    void patientJoinsTheWaitingList() {
        Patient patient = createPatient();
        WaitlistForm form = new WaitlistForm();
        form.setDoctorId(doctor.getId());
        form.setPreferredFrom(LocalDate.now().plusDays(1));
        form.setPreferredTo(LocalDate.now().plusDays(7));
        form.setNote("Mornings only, please");

        WaitlistEntry entry = waitlistService.join(patient, form);

        assertEquals(WaitlistEntry.Status.WAITING, entry.getStatus());
        assertEquals(patient.getId(), entry.getPatient().getId());
        assertTrue(waitlistService.board(patient, null, false).get("entries").toString()
                .contains(patient.getFullName()), "the patient can see their own place on the list");

        BusinessRuleException twice = assertThrows(BusinessRuleException.class,
                () -> waitlistService.join(patient, form));
        assertTrue(twice.getMessage().contains("already has a place"));
    }

    @Test
    @DisplayName("A patient may leave the waiting list, and cannot touch somebody else's place")
    void waitingListBelongsToThePatient() {
        Patient mine = createPatient();
        Patient someoneElse = createPatient();
        WaitlistForm form = new WaitlistForm();
        form.setDoctorId(doctor.getId());
        form.setPreferredFrom(LocalDate.now().plusDays(1));
        WaitlistEntry entry = waitlistService.join(mine, form);

        assertThrows(AccessDeniedException.class,
                () -> waitlistService.cancel(someoneElse, entry.getId()),
                "only the patient on the list (or the clinic) may close it");

        WaitlistEntry left = waitlistService.cancel(mine, entry.getId());
        assertEquals(WaitlistEntry.Status.CANCELLED, left.getStatus());
        assertTrue(waitlistRepository.findById(entry.getId()).orElseThrow().getStatus()
                == WaitlistEntry.Status.CANCELLED);
    }

    @Test
    @DisplayName("A cancelled appointment is offered to the patient who has waited longest")
    void freedTimeGoesToTheWaitingList() {
        /* one patient books a time, another waits for that doctor */
        Patient booked = createPatient();
        Patient waiting = createPatient();
        DoctorAvailability slot = futureSlot();
        Appointment appointment = book(booked, slot);

        WaitlistForm form = new WaitlistForm();
        form.setDoctorId(doctor.getId());
        form.setPreferredFrom(LocalDate.now());
        WaitlistEntry entry = waitlistService.join(waiting, form);

        appointmentService.cancel(appointment.getId(), "I cannot attend after all", booked);

        WaitlistEntry offered = waitlistRepository.findById(entry.getId()).orElseThrow();
        assertEquals(WaitlistEntry.Status.OFFERED, offered.getStatus(),
                "the freed time must be offered to the person waiting longest");
        assertNotNull(offered.getOfferedTime(), "and the offered time must be recorded");
        assertEquals(slot.getId(), offered.getOfferedSlotId());
    }

    @Test
    @DisplayName("Booking a time closes the patient's own place on that doctor's waiting list")
    void bookingClosesTheWaitingPlace() {
        Patient patient = createPatient();
        WaitlistForm form = new WaitlistForm();
        form.setDoctorId(doctor.getId());
        form.setPreferredFrom(LocalDate.now());
        WaitlistEntry entry = waitlistService.join(patient, form);

        book(patient, futureSlot());

        assertEquals(WaitlistEntry.Status.BOOKED,
                waitlistRepository.findById(entry.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("A freed time is only offered to a patient whose own dates suit it")
    void freedTimeMustSuitThePatient() {
        Patient patient = createPatient();

        /* the first patient joins but can only come much later */
        Patient early = createPatient();
        WaitlistForm onlyLater = new WaitlistForm();
        onlyLater.setDoctorId(doctor.getId());
        onlyLater.setPreferredFrom(LocalDate.now().plusDays(20));
        WaitlistEntry earlyEntry = waitlistService.join(early, onlyLater);

        /* a second patient joins after, with no dates at all */
        WaitlistForm openDates = new WaitlistForm();
        openDates.setDoctorId(doctor.getId());
        openDates.setPreferredFrom(LocalDate.now());
        WaitlistEntry openEntry = waitlistService.join(patient, openDates);

        /* somebody else holds the time, so no waiting place closes by itself */
        Patient holder = createPatient();
        Appointment appointment = book(holder, futureSlot());
        appointmentService.cancel(appointment.getId(), "Cannot attend", holder);

        assertEquals(WaitlistEntry.Status.OFFERED,
                waitlistRepository.findById(openEntry.getId()).orElseThrow().getStatus(),
                "the freed day must go to the patient it suits");
        assertEquals(WaitlistEntry.Status.WAITING,
                waitlistRepository.findById(earlyEntry.getId()).orElseThrow().getStatus(),
                "a day the first patient cannot attend must not be offered to them");
    }

    @Test
    @DisplayName("If somebody else books the offered time, the patient keeps their place")
    void offerTakenByAnotherPatient() {
        Patient waiting = createPatient();
        Patient quicker = createPatient();
        DoctorAvailability slot = futureSlot();

        WaitlistForm form = new WaitlistForm();
        form.setDoctorId(doctor.getId());
        form.setPreferredFrom(LocalDate.now());
        WaitlistEntry entry = waitlistService.join(waiting, form);

        waitlistService.offer(admin, entry.getId(), slot.getId(), "a free time");

        /* somebody else books that very time first */
        book(quicker, slot);

        WaitlistEntry after = waitlistRepository.findById(entry.getId()).orElseThrow();
        assertEquals(WaitlistEntry.Status.WAITING, after.getStatus(),
                "the offer must be taken back, not left pointing at a taken time");
        assertNull(after.getOfferedTime(), "and the offered time cleared");
        assertNull(after.getOfferedSlotId());
    }

    @Test
    @DisplayName("Two slots of the same doctor may not overlap")
    void overlappingSlotsAreRejected() {
        LocalDate day = nextWorkingDay();
        createSlot(day, LocalTime.of(10, 0), LocalTime.of(11, 0));

        AvailabilityForm overlap = new AvailabilityForm();
        overlap.setDoctorId(doctor.getId());
        overlap.setSlotDate(day);
        overlap.setStartTime(LocalTime.of(10, 30));
        overlap.setEndTime(LocalTime.of(11, 30));

        assertThrows(BusinessRuleException.class, () -> scheduleService.create(overlap, admin));
    }

    @Test
    @DisplayName("A slot must have a sensible window")
    void invalidSlotWindowsAreRejected() {
        AvailabilityForm backwards = new AvailabilityForm();
        backwards.setDoctorId(doctor.getId());
        backwards.setSlotDate(nextWorkingDay());
        backwards.setStartTime(LocalTime.of(15, 0));
        backwards.setEndTime(LocalTime.of(14, 0));
        assertThrows(BusinessRuleException.class, () -> scheduleService.create(backwards, admin));

        AvailabilityForm yesterday = new AvailabilityForm();
        yesterday.setDoctorId(doctor.getId());
        yesterday.setSlotDate(LocalDate.now().minusDays(1));
        yesterday.setStartTime(LocalTime.of(9, 0));
        yesterday.setEndTime(LocalTime.of(10, 0));
        assertThrows(BusinessRuleException.class, () -> scheduleService.create(yesterday, admin));
    }

    @Test
    @DisplayName("A slot that already carries an appointment cannot be blocked or deleted")
    void bookedSlotsAreProtected() {
        Patient patient = createPatient();
        DoctorAvailability slot = futureSlot();
        book(patient, slot);

        assertThrows(BusinessRuleException.class,
                () -> scheduleService.block(slot.getId(), "Team meeting", admin));
        assertThrows(BusinessRuleException.class,
                () -> scheduleService.delete(slot.getId(), admin));

        assertEquals("Booked", availabilityRepository.findById(slot.getId()).orElseThrow().getStatusLabel());
    }

    // ----------------------------------------------------------------- fixtures

    /** The first administrator has to exist before any other account can be created. */
    private User ensureAdmin() {
        return userRepository.findByUsernameIgnoreCase("testadmin").orElseGet(() -> {
            Staff staff = new Staff("testadmin", PasswordUtil.hash("admin123"),
                    "Test Administrator", UserRole.ADMIN);
            staff.updateStaffDetails("System Administrator", "EMP-001", "Counter 1", UserRole.ADMIN);
            return userRepository.save(staff);
        });
    }

    private DoctorForm doctorForm() {
        int n = COUNTER.incrementAndGet();
        DoctorForm form = new DoctorForm();
        form.setFullName("Dr. Test Physician " + n);
        form.setUsername("testdoctor" + n);
        form.setPassword("doctor123");
        form.setEmail("doctor" + n + "@example.com");
        form.setPhone("+94 71 000 00" + n);
        form.setSpecialization("General Physician");
        form.setQualifications("MBBS");
        form.setRegistrationNo("SLMC-T" + n);
        form.setConsultationMinutes(15);
        form.setConsultationFee(2500.0);
        form.setRoomNo("Room " + n);
        return form;
    }

    private Patient createPatient() {
        int n = COUNTER.incrementAndGet();
        PatientForm form = new PatientForm();
        form.setFullName("Test Patient " + n);
        form.setUsername("testpatient" + n);
        form.setPassword("patient123");
        form.setEmail("patient" + n + "@example.com");
        form.setPhone("+94 77 000 00" + n);
        form.setDateOfBirth(LocalDate.of(1990, 1, 1));
        form.setGender("Female");
        form.setNic("90000000" + n + "V");
        form.setAddress("1, Test Road");
        form.setCity("Ratnapura");
        form.setBloodGroup("O+");
        form.setEmergencyContactName("Test Contact " + n);
        form.setEmergencyContactPhone("+94 77 111 11" + n);
        return patientService.register(form, admin);
    }

    /** A free future slot for the test doctor. */
    private DoctorAvailability futureSlot() {
        int n = COUNTER.incrementAndGet();
        LocalDate day = nextWorkingDay().plusDays(n % 5);
        LocalTime start = LocalTime.of(9, 0).plusMinutes((long) (n % 8) * 15);
        return createSlot(day, start, start.plusMinutes(15));
    }

    private DoctorAvailability createSlot(LocalDate day, LocalTime start, LocalTime end) {
        AvailabilityForm form = new AvailabilityForm();
        form.setDoctorId(doctor.getId());
        form.setSlotDate(day);
        form.setStartTime(start);
        form.setEndTime(end);
        form.setRemarks("Test session");
        return scheduleService.create(form, admin).get(0);
    }

    /**
     * A consultation that is already over. The services refuse to create such a
     * record (correctly), so the fixture writes it straight through the entities -
     * this is exactly what the demonstration data does for the cancelled history.
     */
    private Appointment pastAppointment(Patient patient) {
        LocalDate day = LocalDate.now().minusDays(3);
        DoctorAvailability slot = new DoctorAvailability(doctor, day,
                LocalTime.of(11, 0), LocalTime.of(11, 15));
        DoctorAvailability savedSlot = availabilityRepository.save(slot);
        savedSlot.markBooked();
        availabilityRepository.save(savedSlot);

        Appointment appointment = new Appointment("TEST-PAST-" + COUNTER.incrementAndGet(),
                patient, doctor, savedSlot, day, LocalTime.of(11, 0), LocalTime.of(11, 15),
                "Follow-up consultation", "TEST");
        Appointment saved = appointmentRepository.save(appointment);
        assertNotNull(saved.getId());
        return saved;
    }

    private Appointment book(Patient patient, DoctorAvailability slot) {
        AppointmentForm form = new AppointmentForm();
        form.setPatientId(patient.getId());
        form.setDoctorId(doctor.getId());
        form.setSlotId(slot.getId());
        form.setReason("Test consultation");
        return appointmentService.book(form, admin);
    }

    /** The clinic is closed on Sundays, so the fixtures book the next non-Sunday. */
    private LocalDate nextWorkingDay() {
        LocalDate day = LocalDate.now().plusDays(1);
        while (day.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            day = day.plusDays(1);
        }
        return day;
    }
}
