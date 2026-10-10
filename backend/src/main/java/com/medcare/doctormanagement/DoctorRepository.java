package com.medcare.doctormanagement;

import com.medcare.doctormanagement.Doctor;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Component 02 - Doctor Management (data access). */
public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    @Query("""
            select d from Doctor d
            where (:keyword is null
                   or lower(d.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(d.specialization) like lower(concat('%', :keyword, '%'))
                   or lower(d.qualifications) like lower(concat('%', :keyword, '%')))
              and (:specialization is null or lower(d.specialization) = lower(:specialization))
              and (:status is null
                   or (:status = 'ACTIVE' and d.active = true)
                   or (:status = 'INACTIVE' and d.active = false))
            order by d.fullName asc
            """)
    List<Doctor> search(@Param("keyword") String keyword,
                        @Param("specialization") String specialization,
                        @Param("status") String status);

    @Query("select distinct d.specialization from Doctor d where d.specialization is not null order by d.specialization asc")
    List<String> findDistinctSpecializations();

    List<Doctor> findByActiveTrueOrderByFullNameAsc();

    long countByActiveTrue();
}
