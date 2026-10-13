package com.medcare.availability;

import com.medcare.availability.DoctorAvailability;
import com.medcare.doctormanagement.Doctor;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 05 - Doctor Availability and Schedule Management (data access). */
public interface DoctorAvailabilityRepository extends JpaRepository<DoctorAvailability, Long> {

    @Query("""
            select s from DoctorAvailability s join fetch s.doctor d
            where (:doctorId is null or d.id = :doctorId)
              and (:from is null or s.slotDate >= :from)
              and (:to is null or s.slotDate <= :to)
              and (:status is null or s.status = :status)
            order by s.slotDate asc, s.startTime asc
            """)
    List<DoctorAvailability> search(@Param("doctorId") Long doctorId,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to,
                                    @Param("status") DoctorAvailability.SlotStatus status);

    @Query("""
            select s from DoctorAvailability s join fetch s.doctor d
            where (:doctorId is null or d.id = :doctorId)
              and s.slotDate >= :from
              and s.status = com.medcare.availability.DoctorAvailability$SlotStatus.AVAILABLE
            order by s.slotDate asc, s.startTime asc
            """)
    List<DoctorAvailability> findOpenSlots(@Param("doctorId") Long doctorId, @Param("from") LocalDate from);

    @Query("""
            select count(s) from DoctorAvailability s
            where s.doctor.id = :doctorId and s.slotDate = :date
              and s.status <> com.medcare.availability.DoctorAvailability$SlotStatus.BLOCKED
              and s.startTime < :endTime and s.endTime > :startTime
            """)
    long countOverlapping(@Param("doctorId") Long doctorId,
                          @Param("date") LocalDate date,
                          @Param("startTime") LocalTime startTime,
                          @Param("endTime") LocalTime endTime);

    @Query("""
            select count(s) from DoctorAvailability s
            where s.doctor.id = :doctorId and s.slotDate = :date and s.id <> :ignoreSlotId
              and s.status <> com.medcare.availability.DoctorAvailability$SlotStatus.BLOCKED
              and s.startTime < :endTime and s.endTime > :startTime
            """)
    long countOverlappingExcluding(@Param("doctorId") Long doctorId,
                                   @Param("date") LocalDate date,
                                   @Param("startTime") LocalTime startTime,
                                   @Param("endTime") LocalTime endTime,
                                   @Param("ignoreSlotId") Long ignoreSlotId);

    long countByStatus(DoctorAvailability.SlotStatus status);

    boolean existsByDoctorId(Long doctorId);

    @Query("select count(s) from DoctorAvailability s where s.slotDate >= :from "
            + "and s.status = com.medcare.availability.DoctorAvailability$SlotStatus.AVAILABLE")
    long countUpcomingAvailable(@Param("from") LocalDate from);
}
