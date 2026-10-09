package com.medcare.common.photos;

/**
 * Component 04 - Access Control (profile photograph requests).
 *
 * <p>A page sends one of these when somebody chooses a picture on the profile
 * page. Two shapes are allowed:</p>
 *
 * <ul>
 *   <li>an uploaded picture - {@code format = "base64"} (what a phone camera or
 *       the crop window sends) or {@code format = "file"} (a plain picture file
 *       sent through the simple upload form);</li>
 *   <li>a picture picked from the clinic's own library -
 *       {@code format = "library"} with the short file name.</li>
 * </ul>
 *
 * <p>Validation itself lives in {@link PhotoStorage}, not here and not in the
 * page: this class is only a carrier.</p>
 */
public class PhotoForm {

    /** {@code base64}, {@code file} or {@code library}. */
    private String format = "base64";

    /** The picture itself, or the short file name when the library was used. */
    private String payload;

    /** Original file name when a file was uploaded (kept for the record only). */
    private String fileName;

    public String getFormat() {
        return format == null ? "base64" : format.trim().toLowerCase();
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }
}
