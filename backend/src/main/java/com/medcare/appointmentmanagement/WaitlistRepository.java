package com.medcare.appointmentmanagement;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 03 - Appointment Management (data access for the waiting list). */
public interface WaitlistRepository extends JpaRepository<WaitlistEntry, Long> {

    @Query("""
            select w from WaitlistEntry w
              join fetch w.patient p join fetch w.doctor d
            where (:doctorId is null or d.id = :doctorId)
              and (:openOnly = false or w.status in
                   (com.medcare.appointmentmanagement.WaitlistEntry$Status.WAITING,
                    com.medcare.appointmentmanagement.WaitlistEntry$Status.OFFERED))
            order by w.status asc, w.createdAt asc
            """)
    List<WaitlistEntry> search(@Param("doctorId") Long doctorId, @Param("openOnly") boolean openOnly);

    @Query("""
            select w from WaitlistEntry w
              join fetch w.patient p join fetch w.doctor d
            where p.id = :patientId
            order by w.createdAt desc
            """)
    List<WaitlistEntry> findByPatient(@Param("patientId") Long patientId);

    /** The people waiting for a doctor, oldest first - the order the clinic calls them in. */
    @Query("""
            select w from WaitlistEntry w
              join fetch w.patient p join fetch w.doctor d
            where d.id = :doctorId and w.status = com.medcare.appointmentmanagement.WaitlistEntry$Status.WAITING
            order by w.createdAt asc
            """)
    List<WaitlistEntry> findWaitingForDoctor(@Param("doctorId") Long doctorId);

    List<WaitlistEntry> findByStatusInOrderByCreatedAtAsc(Collection<WaitlistEntry.Status> statuses);

    boolean existsByPatientIdAndDoctorIdAndStatusIn(Long patientId, Long doctorId,
                                                    Collection<WaitlistEntry.Status> statuses);

    boolean existsByPatientIdAndStatusIn(Long patientId, Collection<WaitlistEntry.Status> statuses);

    long countByStatus(WaitlistEntry.Status status);
}
