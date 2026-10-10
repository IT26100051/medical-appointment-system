package com.medcare.patientmanagement;

import com.medcare.patientmanagement.Patient;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 01 - Patient Management (data access). */
public interface PatientRepository extends JpaRepository<Patient, Long> {

    @Query("""
            select p from Patient p
            where (:keyword is null
                   or lower(p.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(p.username) like lower(concat('%', :keyword, '%'))
                   or lower(p.phone) like lower(concat('%', :keyword, '%'))
                   or lower(p.email) like lower(concat('%', :keyword, '%'))
                   or lower(p.nic) like lower(concat('%', :keyword, '%')))
              and (:status is null
                   or (:status = 'ACTIVE' and p.active = true)
                   or (:status = 'INACTIVE' and p.active = false))
            order by p.fullName asc
            """)
    List<Patient> search(@Param("keyword") String keyword, @Param("status") String status);

    long countByActiveTrue();
}
