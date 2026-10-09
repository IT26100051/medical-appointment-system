package com.medcare.common.web;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.AppointmentRepository;
import com.medcare.doctormanagement.Doctor;
import com.medcare.doctormanagement.DoctorRepository;
import com.medcare.availability.DoctorAvailability;
import com.medcare.availability.DoctorAvailabilityRepository;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.FeedbackRepository;
import com.medcare.patientmanagement.PatientRepository;

/**
 * The small piece of the clinic website that any visitor may see (no sign-in):
 * the list of doctors with their next free appointment, and a few clinic numbers.
 *
 * <p>Only public information is returned here - never personal details of patients.</p>
 */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final DoctorRepository doctorRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final FeedbackRepository feedbackRepository;

    public PublicController(DoctorRepository doctorRepository,
                            DoctorAvailabilityRepository availabilityRepository,
                            PatientRepository patientRepository,
                            AppointmentRepository appointmentRepository,
                            FeedbackRepository feedbackRepository) {
        this.doctorRepository = doctorRepository;
        this.availabilityRepository = availabilityRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.feedbackRepository = feedbackRepository;
    }

    /** Active doctors, with the next free appointment of each one. */
    @GetMapping("/doctors")
    @Transactional(readOnly = true)
    public Map<String, Object> doctors() {
        List<Map<String, Object>> cards = new ArrayList<>();
        for (Doctor doctor : doctorRepository.findByActiveTrueOrderByFullNameAsc()) {
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("id", doctor.getId());
            card.put("name", doctor.getFullName());
            card.put("title", "Dr. " + doctor.getFullName());
            card.put("specialization", doctor.getSpecialization());
            card.put("qualifications", doctor.getQualifications());
            card.put("registrationNo", doctor.getRegistrationNo());
            card.put("roomNo", doctor.getRoomNo());
            card.put("consultationMinutes", doctor.getConsultationMinutes());
            card.put("consultationFee", doctor.getConsultationFee());
            card.put("photo", doctor.getPhotoUrl());
            card.put("rating", round(feedbackRepository.averageRating(doctor.getId())));
            card.put("reviews", feedbackRepository.countByDoctorIdAndModeration(doctor.getId(),
                    Feedback.Moderation.VISIBLE));

            List<DoctorAvailability> open = availabilityRepository
                    .findOpenSlots(doctor.getId(), LocalDate.now());
            if (!open.isEmpty()) {
                DoctorAvailability next = open.get(0);
                card.put("nextSlot", DAY.format(next.getSlotDate()) + " at " + TIME.format(next.getStartTime()));
                card.put("nextSlotDate", next.getSlotDate().toString());
                card.put("nextSlotTime", next.getStartTime().toString());
                // the first few open times, shown on the doctor's profile card
                card.put("nextSlots", open.stream().limit(3).map(slot -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("date", slot.getSlotDate().toString());
                    entry.put("time", slot.getStartTime().toString());
                    entry.put("endsAt", slot.getEndTime().toString());
                    return entry;
                }).toList());
            } else {
                card.put("nextSlot", null);
                card.put("nextSlotDate", null);
                card.put("nextSlotTime", null);
                card.put("nextSlots", List.of());
            }
            cards.add(card);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("doctors", cards);
        response.put("generatedAt", LocalDateTime.now().toString());
        return response;
    }

    /**
     * Published patient reviews for the home page. Only the first name and the
     * first letter of the surname are shown, which is how real clinic websites
     * protect their patients' privacy.
     */
    @GetMapping("/reviews")
    @Transactional(readOnly = true)
    public Map<String, Object> reviews() {
        List<Map<String, Object>> reviews = new ArrayList<>();
        for (Feedback feedback : feedbackRepository
                .findTop8ByModerationOrderByCreatedAtDesc(Feedback.Moderation.VISIBLE)) {
            Map<String, Object> review = new LinkedHashMap<>();
            review.put("patient", shortName(feedback.getPatient() == null ? null
                    : feedback.getPatient().getFullName()));
            review.put("patientPhoto", feedback.getPatient() == null ? null
                    : feedback.getPatient().getPhotoUrl());
            review.put("doctor", feedback.getDoctor() == null ? null
                    : "Dr. " + feedback.getDoctor().getFullName());
            review.put("doctorPhoto", feedback.getDoctor() == null ? null
                    : feedback.getDoctor().getPhotoUrl());
            review.put("specialization", feedback.getDoctor() == null ? null
                    : feedback.getDoctor().getSpecialization());
            review.put("rating", feedback.getRating());
            review.put("comments", feedback.getComments());
            review.put("date", feedback.getCreatedAt() == null ? null
                    : feedback.getCreatedAt().toLocalDate().toString());
            reviews.add(review);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviews", reviews);
        return body;
    }

    /** "Nimasha Perera" -> "Nimasha P." */
    private String shortName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return "A patient";
        }
        String[] parts = fullName.trim().split("\\s+");
        return parts.length == 1 ? parts[0] : parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }

    /** A few clinic numbers for the home page. */
    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("doctors", doctorRepository.countByActiveTrue());
        summary.put("patients", patientRepository.countByActiveTrue());
        summary.put("consultationsCompleted", appointmentRepository.countByStatus(Appointment.Status.COMPLETED));
        summary.put("appointmentsBooked", appointmentRepository.count());
        summary.put("averageRating", round(feedbackRepository.averageRating(null)));
        summary.put("openAppointments", availabilityRepository.countByStatus(DoctorAvailability.SlotStatus.AVAILABLE));
        return summary;
    }

    private Double round(Double value) {
        return value == null ? null : Math.round(value * 10.0) / 10.0;
    }
}
