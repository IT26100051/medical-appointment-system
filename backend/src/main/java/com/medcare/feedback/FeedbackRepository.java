package com.medcare.feedback;

import com.medcare.feedback.Feedback;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 06 - Feedback and Notification Management (data access). */
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    @Query("""
            select f from Feedback f join fetch f.patient p join fetch f.doctor d join fetch f.appointment a
            where (:doctorId is null or d.id = :doctorId)
              and (:patientId is null or p.id = :patientId)
              and (:moderation is null or f.moderation = :moderation)
              and (:keyword is null
                   or lower(p.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(d.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(f.comments) like lower(concat('%', :keyword, '%')))
            order by f.createdAt desc
            """)
    List<Feedback> search(@Param("doctorId") Long doctorId,
                          @Param("patientId") Long patientId,
                          @Param("moderation") Feedback.Moderation moderation,
                          @Param("keyword") String keyword);

    boolean existsByAppointmentId(Long appointmentId);

    @Query("select avg(f.rating) from Feedback f where (:doctorId is null or f.doctor.id = :doctorId) "
            + "and f.moderation = com.medcare.feedback.Feedback$Moderation.VISIBLE")
    Double averageRating(@Param("doctorId") Long doctorId);

    long countByModeration(Feedback.Moderation moderation);

    long countByDoctorIdAndModeration(Long doctorId, Feedback.Moderation moderation);

    /** The newest published reviews - shown on the public clinic website. */
    java.util.List<Feedback> findTop8ByModerationOrderByCreatedAtDesc(Feedback.Moderation moderation);
}
