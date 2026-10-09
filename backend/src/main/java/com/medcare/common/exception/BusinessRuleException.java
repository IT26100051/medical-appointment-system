package com.medcare.common.exception;

/**
 * Thrown when a business rule is broken (for example booking a slot that is
 * already taken). Services throw it; the web layer turns it into a clean 400
 * response with the message shown in the user interface.
 *
 * <p>The domain classes ({@code Appointment}, {@code DoctorAvailability}) protect
 * their own state with ordinary {@link IllegalStateException}s. The services pass
 * those calls through {@link #protect(Runnable)} so that a broken rule always
 * reaches the user as one and the same kind of error.</p>
 */
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }

    /** Runs a domain rule and reports a broken one as a business rule error. */
    public static void protect(Runnable rule) {
        try {
            rule.run();
        } catch (IllegalStateException broken) {
            throw new BusinessRuleException(broken.getMessage());
        }
    }
}
