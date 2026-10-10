package com.medcare.appointmentmanagement;

import com.medcare.appointmentmanagement.Appointment;
import com.medcare.feedback.Feedback;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 03 - Appointment Management (data access). */
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    @Query("""
            select a from Appointment a
              join fetch a.patient p join fetch a.doctor d
            where (:patientId is null or p.id = :patientId)
              and (:doctorId is null or d.id = :doctorId)
              and (:status is null or a.status = :status)
              and (:from is null or a.appointmentDate >= :from)
              and (:to is null or a.appointmentDate <= :to)
              and (:keyword is null
                   or lower(a.referenceNo) like lower(concat('%', :keyword, '%'))
                   or lower(p.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(d.fullName) like lower(concat('%', :keyword, '%')))
            order by a.appointmentDate desc, a.startTime desc
            """)
    List<Appointment> search(@Param("patientId") Long patientId,
                             @Param("doctorId") Long doctorId,
                             @Param("status") Appointment.Status status,
                             @Param("from") LocalDate from,
                             @Param("to") LocalDate to,
                             @Param("keyword") String keyword);

    @Query("""
            select a from Appointment a join fetch a.patient p join fetch a.doctor d
            where p.id = :patientId and a.status = com.medcare.appointmentmanagement.Appointment$Status.COMPLETED
            and not exists (select f from Feedback f where f.appointment = a)
            order by a.appointmentDate desc
            """)
    List<Appointment> findCompletedWithoutFeedback(@Param("patientId") Long patientId);

    boolean existsByDoctorIdAndStatusIn(Long doctorId, List<Appointment.Status> statuses);

    boolean existsByPatientIdAndStatusIn(Long patientId, List<Appointment.Status> statuses);

    boolean existsBySlotId(Long slotId);

    long countByStatus(Appointment.Status status);

    /** How many appointments fall on each day of a period (used by the dashboard chart). */
    @Query("select a.appointmentDate, count(a) from Appointment a "
            + "where a.appointmentDate between :from and :to group by a.appointmentDate")
    List<Object[]> countPerDay(@Param("from") LocalDate from, @Param("to") LocalDate to);

    long countByAppointmentDate(LocalDate date);

    long countByPatientId(Long patientId);

    @Query("select count(distinct a.patient.id) from Appointment a where a.doctor.id = :doctorId")
    long countDistinctPatientsByDoctor(@Param("doctorId") Long doctorId);

    @Query("select a from Appointment a join fetch a.patient join fetch a.doctor "
            + "where a.appointmentDate between :from and :to order by a.appointmentDate asc, a.startTime asc")
    List<Appointment> findBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
