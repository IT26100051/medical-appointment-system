package com.medcare.common.web;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;

import com.medcare.common.security.AuthInterceptor;

import jakarta.servlet.http.HttpSession;

/**
 * Serves the three pages of the website.
 *
 * <ul>
 *   <li>{@code /}       - the public clinic home page (no sign-in needed)</li>
 *   <li>{@code /login}  - the sign-in page</li>
 *   <li>{@code /app}    - the patient / staff portal (sign-in required)</li>
 * </ul>
 *
 * <p>The pages are read straight from the {@code frontend} folder while the project
 * is running from source (so edits show up on refresh) and from the copy packaged
 * inside the jar when the application is started as a built artifact.</p>
 */
@Controller
public class PageController {

    private static final List<String> FRONTEND_FOLDERS = List.of("../frontend", "frontend");

    /** Public clinic home page - always available. */
    @GetMapping("/")
    public ResponseEntity<String> home() throws Exception {
        return page("index.html");
    }

    @GetMapping("/login")
    public ResponseEntity<String> login(HttpSession session) throws Exception {
        if (signedIn(session)) {
            return ResponseEntity.status(302).header("Location", "/app").build();
        }
        return page("login.html");
    }

    @GetMapping("/app")
    public ResponseEntity<String> app(HttpSession session) throws Exception {
        if (!signedIn(session)) {
            return ResponseEntity.status(302).header("Location", "/login").build();
        }
        return page("app.html");
    }

    private boolean signedIn(HttpSession session) {
        return session != null && session.getAttribute(AuthInterceptor.SESSION_USER) != null;
    }

    private ResponseEntity<String> page(String fileName) throws Exception {
        for (String folder : FRONTEND_FOLDERS) {
            Path file = Path.of(folder, fileName);
            if (Files.isReadable(file)) {
                return html(Files.readString(file, StandardCharsets.UTF_8));
            }
        }
        ClassPathResource resource = new ClassPathResource("static/" + fileName);
        return html(StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8));
    }

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(body);
    }
}
