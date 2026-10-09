package com.medcare.common.exception;

/** Thrown when the logged-in user is not allowed to perform an action (HTTP 403). */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
