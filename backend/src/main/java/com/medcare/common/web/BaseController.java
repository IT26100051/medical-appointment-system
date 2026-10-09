package com.medcare.common.web;

import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.security.SessionUser;
import com.medcare.common.security.AuthInterceptor;
import com.medcare.common.domain.User;
import com.medcare.accesscontrol.AccountService;
import jakarta.servlet.http.HttpSession;

/** Small helper shared by all controllers: turns the session into an entity. */
public abstract class BaseController {

    private final AccountService accountService;

    protected BaseController(AccountService accountService) {
        this.accountService = accountService;
    }

    protected SessionUser sessionUser(HttpSession session) {
        Object value = session == null ? null : session.getAttribute(AuthInterceptor.SESSION_USER);
        if (value == null) {
            throw new AccessDeniedException("Please sign in to continue");
        }
        return (SessionUser) value;
    }

    /** The JPA entity of the logged-in user - services need the full object. */
    protected User actor(HttpSession session) {
        return accountService.getRequired(sessionUser(session).getId());
    }
}
