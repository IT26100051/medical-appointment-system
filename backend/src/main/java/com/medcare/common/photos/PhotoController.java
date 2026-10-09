package com.medcare.common.photos;

import com.medcare.common.domain.User;
import com.medcare.common.domain.UserRole;
import com.medcare.common.exception.AccessDeniedException;
import com.medcare.common.web.BaseController;
import com.medcare.accesscontrol.AccountService;
import com.medcare.common.web.Dto;
import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Component 04 - Access Control and Staff Management (profile pictures).
 *
 * <p><b>Thin controller.</b> It carries the request to
 * {@link AccountService} and returns what the page needs; every rule (who may
 * change a picture, how big it may be, how it is stored) lives in the service
 * and the domain classes.</p>
 */
@RestController
@RequestMapping("/api/photos")
public class PhotoController extends BaseController {

    private static final long PICTURE = 1L;

    private final AccountService accountService;
    private final PhotoStorage photoStorage;

    public PhotoController(AccountService accountService, PhotoStorage photoStorage) {
        super(accountService);
        this.accountService = accountService;
        this.photoStorage = photoStorage;
    }

    /**
     * The choices shown on the profile picture window: the clinic's own library
     * first, then everybody's faces for the administrator's convenience.
     */
    @GetMapping("/library")
    public Map<String, Object> library(HttpSession session) {
        sessionUser(session);
        List<Map<String, Object>> library = new ArrayList<>();
        for (String file : User.PHOTO_FILES) {
            library.add(entry(file, libraryLabel(file)));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("library", library);
        body.put("default", "img/people/" + User.DEFAULT_PHOTO);
        return body;
    }

    /** Sets the picture of one account (the caller's own, or anybody's when the caller is an administrator). */
    @PostMapping("/{userId}")
    public Map<String, Object> upload(@PathVariable Long userId, @RequestBody PhotoForm form,
                                      HttpSession session) {
        User saved = accountService.changePhoto(userId, form.getFormat(), form.getPayload(),
                form.getFileName(), actor(session));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Profile picture updated");
        body.put("user", Dto.user(saved));
        return body;
    }

    /** Puts the default face back. */
    @DeleteMapping("/{userId}")
    public Map<String, Object> clear(@PathVariable Long userId, HttpSession session) {
        User saved = accountService.removePhoto(userId, actor(session));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "The default profile picture is shown again");
        body.put("user", Dto.user(saved));
        return body;
    }

    /** The signed-in person's own picture, used by the sidebar and the top bar. */
    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        User actor = actor(session);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("photo", actor.getPhotoUrl());
        body.put("defaultPhoto", "img/people/" + actor.defaultPhotoFile());
        body.put("uploaded", photoStorage.isUploadedPicture(actor.getPhoto()));
        body.put("role", actor.getRole().name());
        body.put("canEditOthers", actor.getRole() == UserRole.ADMIN);
        body.put("picture", PICTURE);
        return body;
    }

    private Map<String, Object> entry(String file, String label) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("file", file);
        map.put("url", (photoStorage.isUploadedPicture(file) ? "img/uploads/" : "img/people/") + file);
        map.put("label", label);
        return map;
    }

    /** Friendly names for the clinic's library pictures (the pages must never show a file name). */
    private String libraryLabel(String file) {
        String name = file.replace(".jpg", "").replace(".svg", "").replace("-", " ");
        if (name.startsWith("default avatar")) {
            String kind = name.substring("default avatar".length()).trim();
            return kind.isEmpty() ? "Neutral picture" : ("Default for " + kind + " patients");
        }
        StringBuilder pretty = new StringBuilder();
        for (String word : name.split(" ")) {
            if (pretty.length() > 0) {
                pretty.append(' ');
            }
            pretty.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return pretty.toString();
    }
}
