package com.medcare.accesscontrol;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Component 04 - Access Control and Staff Management (data access).
 *
 * <p>DAO layer of the classic MVC split: services talk to repositories, never
 * directly to the database.</p>
 */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    List<User> findByRoleOrderByFullNameAsc(UserRole role);

    long countByRole(UserRole role);

    long countByRoleAndActiveTrue(UserRole role);

    @Query("""
            select u from User u
            where u.role in (com.medcare.common.domain.UserRole.ADMIN, com.medcare.common.domain.UserRole.RECEPTIONIST)
              and (:keyword is null or lower(u.fullName) like lower(concat('%', :keyword, '%'))
                   or lower(u.username) like lower(concat('%', :keyword, '%')))
            order by u.role asc, u.fullName asc
            """)
    List<User> searchStaff(@Param("keyword") String keyword);

    boolean existsByEmailIgnoreCase(String email);
}
