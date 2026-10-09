package com.medcare.common.dashboard;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.availability.DoctorAvailability;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.feedback.FeedbackRepository;
import com.medcare.feedback.NotificationRepository;
import com.medcare.patientmanagement.PatientRepository;
import com.medcare.accesscontrol.UserRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds the numbers shown on the dashboard - role aware. */
@Service
public class DashboardService {

    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final FeedbackRepository feedbackRepository;
    private final NotificationRepository notificationRepository;
    private final com.medcare.appointmentmanagement.WaitlistRepository waitlistRepository;

    public DashboardService(PatientRepository patientRepository,
                            DoctorRepository doctorRepository,
                            UserRepository userRepository,
                            AppointmentRepository appointmentRepository,
                            DoctorAvailabilityRepository availabilityRepository,
                            FeedbackRepository feedbackRepository,
                            NotificationRepository notificationRepository,
                            com.medcare.appointmentmanagement.WaitlistRepository waitlistRepository) {
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.availabilityRepository = availabilityRepository;
        this.feedbackRepository = feedbackRepository;
        this.notificationRepository = notificationRepository;
        this.waitlistRepository = waitlistRepository;
    }

    /**
     * Appointment counts for the last 14 days - drawn as a small chart on the
     * dashboard so the clinic team can see the shape of the week at a glance.
     */
    @Transactional(readOnly = true)
    public java.util.List<Map<String, Object>> activitySeries() {
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(13);
        Map<LocalDate, Long> counted = new java.util.HashMap<>();
        for (Object[] row : appointmentRepository.countPerDay(from, to)) {
            counted.put((LocalDate) row[0], ((Number) row[1]).longValue());
        }
        java.util.List<Map<String, Object>> series = new java.util.ArrayList<>();
        java.time.format.DateTimeFormatter label = java.time.format.DateTimeFormatter.ofPattern("d MMM");
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", day.toString());
            point.put("label", label.format(day));
            point.put("weekday", day.getDayOfWeek().name().substring(0, 3));
            point.put("count", counted.getOrDefault(day, 0L));
            series.add(point);
        }
        return series;
    }

    /**
     * The numbers shown on the dashboard - and <strong>only</strong> the numbers
     * that concern the person asking for them.
     *
     * <p>A patient is told about their own visits (and the clinic facts that are
     * already on the public pages, such as how many specialists there are). The
     * clinic's totals belong to the people who run the clinic - a hospital never
     * tells one patient how many other patients it has, how many staff accounts
     * exist or how many appointments the whole clinic holds.</p>
     */
    @Transactional(readOnly = true)
    public Map<String, Object> statsFor(User actor) {
        Map<String, Object> stats = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();
        UserRole role = actor.getRole();

        /* figures that are public already (the clinic website shows them too) */
        stats.put("doctors", doctorRepository.countByActiveTrue());
        stats.put("averageRating", round(feedbackRepository.averageRating(null)));
        stats.put("unreadNotifications", notificationRepository.countByRecipientIdAndReadFlagFalse(actor.getId()));

        if (role == UserRole.PATIENT) {
            var mine = appointmentRepository.search(actor.getId(), null, null, null, null, null);
            stats.put("myTotal", (long) mine.size());
            stats.put("myUpcoming", mine.stream().filter(a -> a.getStatus().isOpen()).count());
            stats.put("myCompleted", mine.stream()
                    .filter(a -> a.getStatus() == Appointment.Status.COMPLETED).count());
            stats.put("myCancelled", mine.stream()
                    .filter(a -> a.getStatus() == Appointment.Status.CANCELLED).count());
            stats.put("availableSlots", availabilityRepository.countUpcomingAvailable(today));
            /* their own places on the waiting list, so the portal can remind them */
            var places = waitlistRepository.findByPatient(actor.getId());
            stats.put("myWaitingPlaces", places.stream()
                    .filter(com.medcare.appointmentmanagement.WaitlistEntry::isOpen).count());
            stats.put("myOfferedPlace", places.stream()
                    .filter(entry -> entry.getStatus() == com.medcare.appointmentmanagement.WaitlistEntry.Status.OFFERED)
                    .findFirst()
                    .map(entry -> "Dr. " + entry.getDoctor().getFullName() + " - " + entry.getOfferedTime())
                    .orElse(null));
            return stats;
        }

        if (role == UserRole.DOCTOR) {
            var mine = appointmentRepository.search(null, actor.getId(), null, null, null, null);
            stats.put("myTotal", (long) mine.size());
            stats.put("myUpcoming", mine.stream().filter(a -> a.getStatus().isOpen()).count());
            stats.put("myCompleted", mine.stream()
                    .filter(a -> a.getStatus() == Appointment.Status.COMPLETED).count());
            stats.put("myToday", mine.stream().filter(a -> today.equals(a.getAppointmentDate())).count());
            stats.put("myPending", mine.stream()
                    .filter(a -> a.getStatus() == Appointment.Status.PENDING).count());
            stats.put("myPatients", appointmentRepository.countDistinctPatientsByDoctor(actor.getId()));
            stats.put("mySlots", availabilityRepository.search(actor.getId(), today, null,
                    DoctorAvailability.SlotStatus.AVAILABLE).size());
            stats.put("myRating", round(feedbackRepository.averageRating(actor.getId())));
            stats.put("myWaitingList", waitlistRepository.search(actor.getId(), true).size());
            stats.put("availableSlots", availabilityRepository.countUpcomingAvailable(today));
            return stats;
        }

        /* the front desk and the administrator run the clinic, so they see it whole */
        stats.put("patients", patientRepository.count());
        stats.put("activePatients", patientRepository.countByActiveTrue());
        stats.put("activeDoctors", doctorRepository.countByActiveTrue());
        stats.put("staffAccounts", userRepository.countByRole(UserRole.ADMIN)
                + userRepository.countByRole(UserRole.RECEPTIONIST));
        stats.put("appointmentsTotal", appointmentRepository.count());
        stats.put("appointmentsToday", appointmentRepository.countByAppointmentDate(today));
        stats.put("pending", appointmentRepository.countByStatus(Appointment.Status.PENDING));
        stats.put("confirmed", appointmentRepository.countByStatus(Appointment.Status.CONFIRMED));
        stats.put("completed", appointmentRepository.countByStatus(Appointment.Status.COMPLETED));
        stats.put("cancelled", appointmentRepository.countByStatus(Appointment.Status.CANCELLED));
        stats.put("availableSlots", availabilityRepository.countUpcomingAvailable(today));
        stats.put("feedbackCount", feedbackRepository.count());
        stats.put("waitingList", waitlistRepository.countByStatus(
                com.medcare.appointmentmanagement.WaitlistEntry.Status.WAITING)
                + waitlistRepository.countByStatus(
                com.medcare.appointmentmanagement.WaitlistEntry.Status.OFFERED));
        return stats;
    }

    private static Double round(Double value) {
        return value == null ? null : Math.round(value * 100) / 100.0;
    }
}
