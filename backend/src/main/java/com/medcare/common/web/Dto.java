package com.medcare.common.web;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.appointmentmanagement.QueueService;
import com.medcare.doctormanagement.Doctor;
import com.medcare.availability.DoctorAvailability;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.Notification;
import com.medcare.patientmanagement.Patient;
import com.medcare.accesscontrol.Staff;
import com.medcare.common.domain.User;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Converts domain objects into the small JSON structures the pages need.
 *
 * <p>Keeping this mapping in one class means the browser only ever receives the
 * fields it is allowed to see - the password hash and internal relations never
 * leak out of the service layer.</p>
 */
public final class Dto {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private Dto() {
    }

    public static Map<String, Object> user(User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("fullName", user.getFullName());
        map.put("email", user.getEmail());
        map.put("phone", user.getPhone());
        map.put("role", user.getRole().name());
        map.put("roleDisplay", user.getRole().getDisplayName());
        map.put("accountType", user.getAccountType());
        map.put("status", user.getStatusLabel());
        map.put("active", user.isActive());
        map.put("profileSummary", user.getProfileSummary());
        map.put("photo", user.getPhotoUrl());
        map.put("photoDefault", "img/people/" + user.defaultPhotoFile());
        map.put("photoUploaded", com.medcare.common.domain.User.isUploadedPhoto(user.getPhoto()));
        map.put("gender", user.getGender());
        map.put("initials", user.getInitials());
        map.put("createdAt", user.getCreatedAt() == null ? null : user.getCreatedAt().toString());
        map.put("updatedAt", user.getUpdatedAt() == null ? null : user.getUpdatedAt().toString());
        if (user instanceof Patient patient) {
            map.put("dateOfBirth", patient.getDateOfBirth() == null ? null : DATE.format(patient.getDateOfBirth()));
            map.put("age", patient.age());
            map.put("nic", patient.getNic());
            map.put("address", patient.getAddress());
            map.put("city", patient.getCity());
            map.put("bloodGroup", patient.getBloodGroup());
            map.put("emergencyContactName", patient.getEmergencyContactName());
            map.put("emergencyContactPhone", patient.getEmergencyContactPhone());
            map.put("medicalNotes", patient.getMedicalNotes());
        }
        if (user instanceof Doctor doctor) {
            map.put("specialization", doctor.getSpecialization());
            map.put("qualifications", doctor.getQualifications());
            map.put("registrationNo", doctor.getRegistrationNo());
            map.put("consultationMinutes", doctor.getConsultationMinutes());
            map.put("consultationFee", doctor.getConsultationFee());
            map.put("roomNo", doctor.getRoomNo());
        }
        if (user instanceof Staff staff) {
            map.put("designation", staff.getDesignation());
            map.put("employeeCode", staff.getEmployeeCode());
            map.put("counterNo", staff.getCounterNo());
        }
        return map;
    }

    public static Map<String, Object> slot(DoctorAvailability slot) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", slot.getId());
        map.put("doctorId", slot.getDoctor() == null ? null : slot.getDoctor().getId());
        map.put("doctorName", slot.getDoctor() == null ? "-" : "Dr. " + slot.getDoctor().getFullName());
        map.put("doctorPhoto", slot.getDoctor() == null ? null : slot.getDoctor().getPhotoUrl());
        map.put("specialization", slot.getDoctor() == null ? null : slot.getDoctor().getSpecialization());
        map.put("date", DATE.format(slot.getSlotDate()));
        map.put("startTime", TIME.format(slot.getStartTime()));
        map.put("endTime", TIME.format(slot.getEndTime()));
        map.put("timeLabel", TIME.format(slot.getStartTime()) + " - " + TIME.format(slot.getEndTime()));
        map.put("status", slot.getStatus().name());
        map.put("statusLabel", slot.getStatusLabel());
        map.put("remarks", slot.getRemarks());
        return map;
    }

    public static Map<String, Object> appointment(Appointment a) {
        return appointment(a, null);
    }

    /**
     * The same record with the person's place in the clinic queue added. The
     * token itself is worked out by the queue service - here it is only carried
     * to the page.
     */
    public static Map<String, Object> appointment(Appointment a, QueueService.Token token) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", a.getId());
        map.put("referenceNo", a.getReferenceNo());
        map.put("patientId", a.getPatient() == null ? null : a.getPatient().getId());
        map.put("patientName", a.getPatient() == null ? "-" : a.getPatient().getFullName());
        map.put("patientPhoto", a.getPatient() == null ? null : a.getPatient().getPhotoUrl());
        map.put("patientPhone", a.getPatient() == null ? null : a.getPatient().getPhone());
        map.put("doctorId", a.getDoctor() == null ? null : a.getDoctor().getId());
        map.put("doctorName", a.getDoctor() == null ? "-" : "Dr. " + a.getDoctor().getFullName());
        map.put("doctorPhoto", a.getDoctor() == null ? null : a.getDoctor().getPhotoUrl());
        map.put("specialization", a.getDoctor() == null ? null : a.getDoctor().getSpecialization());
        map.put("date", DATE.format(a.getAppointmentDate()));
        map.put("startTime", TIME.format(a.getStartTime()));
        map.put("endTime", TIME.format(a.getEndTime()));
        map.put("timeLabel", TIME.format(a.getStartTime()) + " - " + TIME.format(a.getEndTime()));
        map.put("status", a.getStatus().name());
        map.put("statusLabel", a.getStatus().getLabel());
        map.put("reason", a.getReason());
        map.put("notes", a.getNotes());
        map.put("cancellationReason", a.getCancellationReason());
        map.put("cancelledBy", a.getCancelledBy());
        map.put("createdBy", a.getCreatedBy());
        map.put("createdAt", a.getCreatedAt() == null ? null : a.getCreatedAt().toString());
        map.put("updatedAt", a.getUpdatedAt() == null ? null : a.getUpdatedAt().toString());
        map.put("priority", a.getPriority().name());
        map.put("priorityLabel", a.getPriority().getLabel());
        map.put("priorityNote", a.getPriority().getDescription());
        map.put("visitSummary", a.getVisitSummary());
        map.put("followUpDate", a.getFollowUpDate() == null ? null : DATE.format(a.getFollowUpDate()));
        map.put("followUpNotes", a.getFollowUpNotes());
        map.put("daysAway", a.daysAway());
        map.put("upcoming", a.isInFuture());
        map.put("canFeedback", a.getStatus() == Appointment.Status.COMPLETED);
        map.put("token", token == null ? null : token.number());
        map.put("waitingAhead", token == null ? null : token.waitingAhead());
        map.put("estimatedWaitMinutes", token == null ? null : token.estimatedWaitMinutes());
        map.put("tokenNote", token == null ? null : token.note());
        return map;
    }

    public static Map<String, Object> feedback(Feedback f) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", f.getId());
        map.put("appointmentId", f.getAppointment() == null ? null : f.getAppointment().getId());
        map.put("appointmentRef", f.getAppointment() == null ? "-" : f.getAppointment().getReferenceNo());
        map.put("appointmentDate", f.getAppointment() == null ? null
                : DATE.format(f.getAppointment().getAppointmentDate()));
        map.put("patientId", f.getPatient() == null ? null : f.getPatient().getId());
        map.put("patientName", f.getPatient() == null ? "-" : f.getPatient().getFullName());
        map.put("doctorId", f.getDoctor() == null ? null : f.getDoctor().getId());
        map.put("doctorName", f.getDoctor() == null ? "-" : "Dr. " + f.getDoctor().getFullName());
        map.put("doctorPhoto", f.getDoctor() == null ? null : f.getDoctor().getPhotoUrl());
        map.put("patientPhoto", f.getPatient() == null ? null : f.getPatient().getPhotoUrl());
        map.put("rating", f.getRating());
        map.put("comments", f.getComments());
        map.put("moderation", f.getModeration().name());
        map.put("moderationLabel", f.getModeration().getLabel());
        map.put("moderationNote", f.getModerationNote());
        map.put("createdAt", f.getCreatedAt() == null ? null : f.getCreatedAt().toString());
        map.put("updatedAt", f.getUpdatedAt() == null ? null : f.getUpdatedAt().toString());
        return map;
    }

    public static Map<String, Object> notification(Notification n) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", n.getId());
        map.put("type", n.getType().name());
        map.put("typeLabel", n.getType().getLabel());
        map.put("title", n.getTitle());
        map.put("message", n.getMessage());
        map.put("appointmentId", n.getRelatedAppointmentId());
        map.put("read", n.isRead());
        map.put("createdAt", n.getCreatedAt() == null ? null : n.getCreatedAt().toString());
        return map;
    }
}
