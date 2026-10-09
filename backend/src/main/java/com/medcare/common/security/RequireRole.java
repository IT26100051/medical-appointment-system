package com.medcare.common.security;

import com.medcare.accesscontrol.Staff;
import com.medcare.common.domain.UserRole;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p><b>Abstraction.</b> Controllers declare <i>who</i> may call them with this
 * annotation; the {@link com.medcare.common.security.AuthInterceptor} enforces it. The
 * controller itself contains no {@code if (role == ...)} statements at all -
 * access decisions are isolated in one security component.</p>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface RequireRole {

    UserRole[] value();
}
