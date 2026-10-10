package com.medcare.appointmentmanagement;

import com.medcare.appointmentmanagement.Appointment.Priority;
import com.medcare.appointmentmanagement.Appointment.Status;
import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 03 - Appointment Management (the clinic queue).
 *
 * <p>Every appointment of a day carries a token number, exactly the way a real
 * hospital hands out a slip at the desk. The token is <em>derived</em>, never
 * stored: it follows from the order in which the clinic will actually see the
 * people of that day - urgent visits first, then everybody else in the order of
 * their appointment time. Because it is derived, it can never drift out of step
 * with the appointment itself.</p>
 *
 * <p>All the rules of the queue live here: the order, the token number, how many
 * patients are still ahead of somebody and how long that is likely to take. The
 * pages only display what this class works out.</p>
 */
@Service
public class QueueService {

    /** A person's place in the line of one doctor on one day. */
    public record Token(Long appointmentId, int number, int waitingAhead, int estimatedWaitMinutes,
                        String note) {
    }

    private final AppointmentRepository appointmentRepository;

    public QueueService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    // ==================================================================
    //  READ - the line of a day
    // ==================================================================

    /**
     * The order in which a doctor will see the people of one day: the visits
     * that are still open (pending or confirmed), urgent ones first, then by
     * appointment time.
     */
    private List<Appointment> lineOfDay(List<Appointment> dayAppointments, Long doctorId) {
        return dayAppointments.stream()
                .filter(a -> doctorId == null
                        || (a.getDoctor() != null && doctorId.equals(a.getDoctor().getId())))
                .filter(a -> a.getStatus().isOpen())
                .sorted(Comparator
                        .comparingInt((Appointment a) -> a.getPriority() == Priority.URGENT ? 0 : 1)
                        .thenComparing(Appointment::getStartTime))
                .collect(Collectors.toList());
    }

    /** Token numbers for a list of appointments (used to decorate the lists). */
    @Transactional(readOnly = true)
    public Map<Long, Token> tokensFor(List<Appointment> appointments) {
        Map<String, List<Appointment>> lines = appointments.stream()
                .filter(a -> a.getDoctor() != null && a.getStatus().isOpen())
                .collect(Collectors.groupingBy(a -> a.getDoctor().getId() + "|" + a.getAppointmentDate(),
                        LinkedHashMap::new, Collectors.toList()));

        Map<Long, Token> tokens = new LinkedHashMap<>();
        lines.values().forEach(line -> {
            List<Appointment> ordered = lineOfDay(line, null);
            int number = 1;
            for (Appointment appointment : ordered) {
                tokens.put(appointment.getId(), token(appointment, ordered, number));
                number++;
            }
        });
        return tokens;
    }

    /** The token of one appointment, looked up against the whole day. */
    @Transactional(readOnly = true)
    public Token tokenOf(Appointment appointment) {
        if (appointment == null || appointment.getDoctor() == null || !appointment.getStatus().isOpen()) {
            return null;
        }
        List<Appointment> day = appointmentRepository.findBetween(appointment.getAppointmentDate(),
                appointment.getAppointmentDate());
        List<Appointment> line = lineOfDay(day, appointment.getDoctor().getId());
        int number = 1;
        for (Appointment candidate : line) {
            if (candidate.getId().equals(appointment.getId())) {
                return token(candidate, line, number);
            }
            number++;
        }
        return null;
    }

    private Token token(Appointment appointment, List<Appointment> line, int number) {
        int minutesEach = minutesOf(appointment);
        int waitingAhead = Math.max(0, number - 1);
        return new Token(appointment.getId(), number, waitingAhead, waitingAhead * minutesEach,
                lineNote(number, waitingAhead, minutesEach, appointment));
    }

    private int minutesOf(Appointment appointment) {
        Integer minutes = appointment.getDoctor() == null ? null
                : appointment.getDoctor().getConsultationMinutes();
        return minutes == null || minutes <= 0 ? 15 : minutes;
    }

    private String lineNote(int number, int waitingAhead, int minutesEach, Appointment appointment) {
        if (waitingAhead == 0) {
            return "You are first in line for this clinic - please take a seat near room "
                    + (appointment.getDoctor() == null || appointment.getDoctor().getRoomNo() == null
                        ? "the consulting room" : appointment.getDoctor().getRoomNo())
                    + ".";
        }
        return "You are number " + number + " in line today, with " + waitingAhead
                + (waitingAhead == 1 ? " patient" : " patients")
                + " ahead of you - about " + (waitingAhead * minutesEach)
                + " minutes of consultations. Please stay in the waiting area.";
    }

    // ==================================================================
    //  READ - the boards the pages show
    // ==================================================================

    /**
     * The queue board of one day. Staff may look at every doctor; a doctor sees
     * only their own clinic; a patient may only see the clinic they are booked
     * in - which they reach through {@link #myPlace(User)} instead.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> board(User actor, LocalDate date, Long doctorId) {
        if (actor.getRole() == UserRole.PATIENT) {
            throw new AccessDeniedException("The clinic queue is viewed by the clinic staff");
        }
        Long scopedDoctorId = actor.getRole() == UserRole.DOCTOR ? actor.getId() : doctorId;
        LocalDate day = date == null ? LocalDate.now() : date;

        List<Appointment> ofDay = appointmentRepository.findBetween(day, day);
        List<Appointment> line = lineOfDay(ofDay, scopedDoctorId);
        Map<Long, Token> tokens = tokensFor(ofDay);

        List<Map<String, Object>> waiting = new ArrayList<>();
        int minutesEach = 15;
        for (Appointment appointment : line) {
            minutesEach = minutesOf(appointment);
            Token token = tokens.get(appointment.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("appointmentId", appointment.getId());
            row.put("referenceNo", appointment.getReferenceNo());
            row.put("token", token == null ? waiting.size() + 1 : token.number());
            row.put("patientId", appointment.getPatient() == null ? null : appointment.getPatient().getId());
            row.put("patientName", appointment.getPatient() == null ? "-" : appointment.getPatient().getFullName());
            row.put("patientPhoto", appointment.getPatient() == null ? null : appointment.getPatient().getPhotoUrl());
            row.put("doctorId", appointment.getDoctor() == null ? null : appointment.getDoctor().getId());
            row.put("doctorName", appointment.getDoctor() == null ? "-" : "Dr. " + appointment.getDoctor().getFullName());
            row.put("specialization", appointment.getDoctor() == null ? null : appointment.getDoctor().getSpecialization());
            row.put("roomNo", appointment.getDoctor() == null ? null : appointment.getDoctor().getRoomNo());
            row.put("startTime", appointment.getStartTime().toString());
            row.put("timeLabel", appointment.getStartTime() + " - " + appointment.getEndTime());
            row.put("status", appointment.getStatus().name());
            row.put("statusLabel", appointment.getStatus().getLabel());
            row.put("priority", appointment.getPriority().name());
            row.put("priorityLabel", appointment.getPriority().getLabel());
            row.put("reason", appointment.getReason());
            row.put("late", appointment.getAppointmentDate().equals(LocalDate.now())
                    && appointment.getEndTime().isBefore(LocalTime.now()));
            waiting.add(row);
        }

        List<Map<String, Object>> seen = ofDay.stream()
                .filter(a -> scopedDoctorId == null
                        || (a.getDoctor() != null && scopedDoctorId.equals(a.getDoctor().getId())))
                .filter(a -> a.getStatus() == Status.COMPLETED)
                .sorted(Comparator.comparing(Appointment::getStartTime))
                .map(this::seenRow)
                .toList();

        List<Map<String, Object>> closed = ofDay.stream()
                .filter(a -> scopedDoctorId == null
                        || (a.getDoctor() != null && scopedDoctorId.equals(a.getDoctor().getId())))
                .filter(a -> a.getStatus() == Status.CANCELLED || a.getStatus() == Status.NO_SHOW)
                .sorted(Comparator.comparing(Appointment::getStartTime))
                .map(this::seenRow)
                .toList();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("waiting", waiting.size());
        summary.put("seen", seen.size());
        summary.put("closed", closed.size());
        summary.put("booked", waiting.size() + seen.size());
        summary.put("averageMinutes", minutesEach);
        summary.put("estimatedClearMinutes", waiting.size() * minutesEach);
        summary.put("nowServing", waiting.isEmpty() ? null : waiting.get(0).get("token"));
        summary.put("nowServingName", waiting.isEmpty() ? null : waiting.get(0).get("patientName"));
        summary.put("nextToken", waiting.size() + 1);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("date", day.toString());
        body.put("doctorId", scopedDoctorId);
        body.put("waiting", waiting);
        body.put("seen", seen);
        body.put("closed", closed);
        body.put("summary", summary);
        body.put("arrivalNote", waiting.isEmpty()
                ? "No patients are waiting for this clinic."
                : "Token " + waiting.get(0).get("token") + " is being seen now.");
        return body;
    }

    private Map<String, Object> seenRow(Appointment appointment) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("appointmentId", appointment.getId());
        row.put("referenceNo", appointment.getReferenceNo());
        row.put("patientName", appointment.getPatient() == null ? "-" : appointment.getPatient().getFullName());
        row.put("patientPhoto", appointment.getPatient() == null ? null : appointment.getPatient().getPhotoUrl());
        row.put("doctorName", appointment.getDoctor() == null ? "-" : "Dr. " + appointment.getDoctor().getFullName());
        row.put("roomNo", appointment.getDoctor() == null ? null : appointment.getDoctor().getRoomNo());
        row.put("timeLabel", appointment.getStartTime() + " - " + appointment.getEndTime());
        row.put("status", appointment.getStatus().name());
        row.put("statusLabel", appointment.getStatus().getLabel());
        row.put("priorityLabel", appointment.getPriority().getLabel());
        row.put("visitSummary", appointment.getVisitSummary());
        return row;
    }

    /** A patient's own place in line, for the page they see after booking. */
    @Transactional(readOnly = true)
    public Map<String, Object> myPlace(User actor, Long appointmentId) {
        if (actor.getRole() != UserRole.PATIENT) {
            throw new AccessDeniedException("This is the patient's own place in line");
        }
        LocalDate today = LocalDate.now();
        List<Appointment> mine = appointmentRepository.findBetween(today, today.plusMonths(6)).stream()
                .filter(a -> a.getPatient() != null && a.getPatient().getId().equals(actor.getId()))
                .filter(a -> a.getStatus().isOpen())
                .sorted(Comparator.comparing(Appointment::getAppointmentDate)
                        .thenComparing(Appointment::getStartTime))
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("hasAppointment", !mine.isEmpty());
        if (mine.isEmpty()) {
            body.put("note", "You have no clinic visit waiting. Book an appointment whenever you need one.");
            return body;
        }
        Appointment next = appointmentId == null ? mine.get(0) : mine.stream()
                .filter(a -> a.getId().equals(appointmentId))
                .findFirst().orElse(mine.get(0));
        Token token = tokenOf(next);
        body.put("appointmentId", next.getId());
        body.put("referenceNo", next.getReferenceNo());
        body.put("date", next.getAppointmentDate().toString());
        body.put("today", next.getAppointmentDate().equals(today));
        body.put("timeLabel", next.getStartTime() + " - " + next.getEndTime());
        body.put("doctorName", next.getDoctor() == null ? "-" : "Dr. " + next.getDoctor().getFullName());
        body.put("roomNo", next.getDoctor() == null ? null : next.getDoctor().getRoomNo());
        body.put("token", token == null ? null : token.number());
        body.put("waitingAhead", token == null ? null : token.waitingAhead());
        body.put("estimatedWaitMinutes", token == null ? null : token.estimatedWaitMinutes());
        body.put("note", token == null ? "This visit is not open any more."
                : (token.number() == 1 ? "You are first in line for this clinic."
                    : "You are number " + token.number() + " in line, with "
                    + token.waitingAhead() + (token.waitingAhead() == 1 ? " patient" : " patients")
                    + " ahead of you."));
        return body;
    }
}
