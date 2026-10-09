package com.medcare.common.photos;

import com.medcare.common.exception.BusinessRuleException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Component 04 - Access Control and Staff Management (profile photographs).
 *
 * <p><b>Abstraction / information hiding.</b> No controller and no page ever
 * touches the file system. A page sends a picture (as a data address or as a
 * plain picture file) and this service decides where it is stored, how big it
 * may be, what shape it gets and which of the four harmless layouts it is kept
 * in. The rest of the system only ever sees the short file name written on the
 * account ({@code custom-12-1.jpg}).</p>
 *
 * <p>Stored pictures live in {@code frontend/img/uploads}. Each uploaded
 * picture keeps the layout it arrived with, next to three other layouts so that
 * the same photograph can be picked from a custom list and always reacts to the
 * pointer with the same hover movement as the demonstration photographs:</p>
 *
 * <pre>
 *   custom-12-1.jpg        the picture as supplied (already square)
 *   custom-12-1-zoom.jpg   enlarged - shown when the pointer rests on it
 * </pre>
 *
 * <p>Every incoming byte is decoded and re-encoded through the image library,
 * so a file that only pretends to be a photograph is rejected before anything
 * is written to disk.</p>
 */
@Service
public class PhotoStorage {

    private static final Logger log = LoggerFactory.getLogger(PhotoStorage.class);

    /** Longest side of the stored picture - keeps portal pages light. */
    private static final int PICTURE_SIZE = 512;
    private static final int ZOOM_SIZE = 768;
    private static final long MAX_BYTES = (long) 8 * 1024 * 1024;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private static final Pattern DATA_PICTURE = Pattern.compile(
            "^data:image/(png|jpe?g|webp|gif|bmp);base64,([A-Za-z0-9+/=\\s]+)$", Pattern.CASE_INSENSITIVE);

    private final Path uploadDirectory;

    public PhotoStorage() {
        this.uploadDirectory = Paths.get("frontend", "img", "uploads").toAbsolutePath().normalize();
    }

    public Path getUploadDirectory() {
        return uploadDirectory;
    }

    /**
     * Stores a picture for a person and returns the file name to write on the
     * account. Accepts either
     * <ul>
     *   <li>a data address ({@code data:image/png;base64,…}) - what the camera,
     *       the crop window and the "choose from the library" list send, or</li>
     *   <li>a normal picture file - what a telephone or an older computer
     *       sends through the simple upload form.</li>
     * </ul>
     *
     * @param ownerId  the account the picture belongs to (used in the file name)
     * @param format   {@code "base64"} or {@code "file"}
     * @param payload  the picture itself
     * @param fileName the original file name when the picture arrives as a file
     */
    public String store(Long ownerId, String format, String payload, String fileName) {
        byte[] bytes = readPayload(format, payload);
        if (bytes.length == 0) {
            throw new BusinessRuleException("The picture file is empty - please choose another one");
        }
        if (bytes.length > MAX_BYTES) {
            throw new BusinessRuleException("That picture is larger than 8 MB - please choose a smaller one");
        }

        BufferedImage source = decode(bytes);
        String extension = "jpg";
        String stamp = LocalDateTime.now().format(STAMP);
        String base = "custom-" + ownerId + "-" + stamp;

        try {
            Files.createDirectories(uploadDirectory);
            BufferedImage square = squareCrop(source, PICTURE_SIZE);
            write(square, extension, base);
            write(squareCrop(source, ZOOM_SIZE, 1.12), extension, base + "-zoom");
            log.info("Stored profile photograph {} for account #{} ({} bytes, was {})",
                    base + "." + extension, ownerId, bytes.length, fileName == null ? "a picture" : fileName);
            return base + "." + extension;
        } catch (IOException failure) {
            throw new BusinessRuleException("The picture could not be saved - please try again");
        }
    }

    /** Removes a picture that was stored earlier (called when a picture is replaced or removed). */
    public void remove(String fileName) {
        if (fileName == null || !fileName.startsWith("custom-")) {
            return;
        }
        String base = fileName.replaceAll("\\.(jpe?g|png|gif|webp|bmp)$", "");
        for (String variant : new String[]{base, base + "-zoom"}) {
            for (String extension : new String[]{".jpg", ".png", ".jpeg"}) {
                try {
                    Files.deleteIfExists(uploadDirectory.resolve(variant + extension));
                } catch (IOException ignored) {
                    // A picture that cannot be removed is not worth failing the whole request for.
                }
            }
        }
    }

    /** True when the file name belongs to a picture a person uploaded themselves. */
    public boolean isUploadedPicture(String fileName) {
        return fileName != null && fileName.toLowerCase(Locale.ROOT).startsWith("custom-");
    }

    // ------------------------------------------------------------------
    //  Internals
    // ------------------------------------------------------------------

    private byte[] readPayload(String format, String payload) {
        if (payload == null || payload.isBlank()) {
            throw new BusinessRuleException("Please choose a picture first");
        }
        if ("file".equalsIgnoreCase(format)) {
            return Base64.getDecoder().decode(payload.replaceAll("\\s", ""));
        }
        Matcher matcher = DATA_PICTURE.matcher(payload.trim());
        if (!matcher.matches()) {
            throw new BusinessRuleException("That does not look like a picture - please choose a JPG or PNG file");
        }
        try {
            return Base64.getDecoder().decode(matcher.group(2).replaceAll("\\s", ""));
        } catch (IllegalArgumentException invalid) {
            throw new BusinessRuleException("That picture could not be read - please choose another one");
        }
    }

    private BufferedImage decode(byte[] bytes) {
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                throw new BusinessRuleException("That file is not a picture - please choose a JPG, PNG, GIF or WEBP image");
            }
            return image;
        } catch (IOException failure) {
            throw new BusinessRuleException("That picture could not be read - please choose another one");
        }
    }

    /** Cuts the middle square out of a picture and scales it to {@code size} by {@code size}. */
    private BufferedImage squareCrop(BufferedImage source, int size) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        return scale(source.getSubimage(x, y, side, side), size);
    }

    /** Same middle square, scaled a little larger - used for the hover movement. */
    private BufferedImage squareCrop(BufferedImage source, int size, double spare) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        int scaled = (int) Math.round(side / spare);
        int offset = (side - scaled) / 2;
        return scale(source.getSubimage(x + offset, y + offset, scaled, scaled), size);
    }

    private BufferedImage scale(BufferedImage image, int size) {
        boolean keepTransparency = image.getColorModel().hasAlpha();
        BufferedImage target = new BufferedImage(size, size,
                keepTransparency ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.drawImage(image, 0, 0, size, size, null);
        graphics.dispose();
        return target;
    }

    private void write(BufferedImage image, String extension, String base) throws IOException {
        Path target = uploadDirectory.resolve(base + "." + extension);
        if (!ImageIO.write(image, extension, target.toFile())) {
            throw new IOException("No writer for " + extension);
        }
    }
}
