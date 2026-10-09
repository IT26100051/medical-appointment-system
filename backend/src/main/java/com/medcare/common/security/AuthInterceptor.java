package com.medcare.common.security;

import com.medcare.accesscontrol.Staff;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.security.RequireRole;
import com.medcare.common.security.SessionUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.Arrays;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Component 04 - Access Control and Staff Management.
 *
 * <p><b>Abstraction.</b> This interceptor is the single gate in front of every
 * API call. It checks (1) that a user is signed in and (2) that the user's role
 * is listed in the controller's {@link RequireRole} annotation. No controller
 * contains a role check of its own.</p>
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String SESSION_USER = "SESSION_USER";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        HttpSession session = request.getSession(false);
        SessionUser user = session == null ? null : (SessionUser) session.getAttribute(SESSION_USER);
        if (user == null) {
            throw new AccessDeniedException("Please sign in to continue");
        }
        request.setAttribute(SESSION_USER, user);

        RequireRole requireRole = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (requireRole == null) {
            requireRole = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
        }
        if (requireRole != null && Arrays.stream(requireRole.value()).noneMatch(r -> r == user.getRole())) {
            throw new AccessDeniedException("Your role (" + user.getRole().getDisplayName()
                    + ") is not allowed to perform this action");
        }
        return true;
    }
}
