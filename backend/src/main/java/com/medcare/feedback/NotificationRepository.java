package com.medcare.feedback;

import com.medcare.feedback.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Component 06 - Notification inbox (data access). */
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    List<Notification> findByRecipientIdAndReadFlagFalseOrderByCreatedAtDesc(Long recipientId);

    long countByRecipientIdAndReadFlagFalse(Long recipientId);

    long countByReadFlagFalse();

    List<Notification> findByReadFlagTrue();

    long countByRelatedAppointmentIdAndRecipientId(Long appointmentId, Long recipientId);
}
