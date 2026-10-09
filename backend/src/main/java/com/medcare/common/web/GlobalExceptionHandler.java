package com.medcare.common.web;

import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.exception.BusinessRuleException;
import com.medcare.common.exception.ResourceNotFoundException;
import com.medcare.common.exception.UnauthenticatedException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Single place that converts exceptions into JSON error responses, so the
 * browser always receives {@code { "message": "..." }} instead of a stack trace.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> notFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), null);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<Map<String, Object>> businessRule(BusinessRuleException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage(), null);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> illegal(RuntimeException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        String first = fields.values().stream().findFirst().orElse("Please check the highlighted fields");
        return build(HttpStatus.BAD_REQUEST, first, fields);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> unknownPath(Exception ex) {
        return build(HttpStatus.NOT_FOUND, "That address does not exist on this server "
                + "(please use the navigation inside the application)", null);
    }

    /**
     * A mistyped address (a word where a number belongs, or a page asked for with
     * the wrong kind of request) is answered as "no such address", never as a
     * server error - the same friendly answer the visitor gets for any unknown
     * page.
     */
    @ExceptionHandler({org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.HttpRequestMethodNotSupportedException.class})
    public ResponseEntity<Map<String, Object>> wrongAddress(Exception ex) {
        return build(HttpStatus.NOT_FOUND, "That address does not exist on this server "
                + "(please use the navigation inside the application)", null);
    }

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> missingInformation(Exception ex) {
        return build(HttpStatus.BAD_REQUEST, "Please fill in the required information and try again", null);
    }

    /** A request that arrives damaged is the caller's problem, and is said so in plain words. */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> unreadable(Exception ex) {
        return build(HttpStatus.BAD_REQUEST,
                "Some of the information sent could not be read. Please fill the form in again.", null);
    }

    @ExceptionHandler(UnauthenticatedException.class)
    public ResponseEntity<Map<String, Object>> unauthenticated(UnauthenticatedException ex) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), null);
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> wrongFormat(Exception ex) {
        return build(HttpStatus.BAD_REQUEST, "That kind of information is not accepted here", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(Exception ex) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "Unexpected error: " + ex.getClass().getSimpleName() + " - " + ex.getMessage(), null);
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message, Map<String, String> fields) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status.value());
        body.put("message", message);
        if (fields != null && !fields.isEmpty()) {
            body.put("fields", fields);
        }
        return ResponseEntity.status(status).body(body);
    }
}
