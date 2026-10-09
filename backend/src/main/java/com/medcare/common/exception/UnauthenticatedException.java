package com.medcare.common.exception;

/**
 * Thrown when the credentials supplied do not match an account (HTTP 401).
 *
 * <p>Kept apart from {@link BusinessRuleException} so the browser is told
 * "you are not signed in" rather than "you filled the form in wrongly".</p>
 */
public class UnauthenticatedException extends RuntimeException {

    public UnauthenticatedException(String message) {
        super(message);
    }
}
