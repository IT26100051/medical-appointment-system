package com.medcare.common.exception;

/** Thrown when a requested record does not exist (mapped to HTTP 404). */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException of(String entity, Object id) {
        return new ResourceNotFoundException(entity + " #" + id + " was not found");
    }
}
