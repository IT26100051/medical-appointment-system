package com.medcare.feedback;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.domain.UserRole;
import com.medcare.common.security.RequireRole;
import com.medcare.common.security.SessionUser;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.feedback.Feedback;
import com.medcare.feedback.FeedbackForm;
import com.medcare.feedback.FeedbackService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Component 06 - Feedback Management (submission, list/moderation, edit, delete). */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController extends BaseController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService, AccountService accountService) {
        super(accountService);
        this.feedbackService = feedbackService;
    }

    // CREATE - Feedback Submission Page
    @PostMapping
    public Map<String, Object> submit(@Valid @RequestBody FeedbackForm form, HttpSession session) {
        Feedback feedback = feedbackService.submit(form, actor(session));
        return Map.of("message", "Thank you - your feedback was submitted",
                "feedback", Dto.feedback(feedback));
    }

    /** Completed appointments that can still be reviewed (feedback submission page). */
    @GetMapping("/eligible")
    @RequireRole(UserRole.PATIENT)
    public Map<String, Object> eligible(HttpSession session) {
        var appointments = feedbackService.eligibleAppointments(sessionUser(session).getId());
        return Map.of("appointments", appointments.stream().map(Dto::appointment).toList());
    }

    // READ - Feedback List / Moderation Page
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) Long doctorId,
                                    @RequestParam(required = false) Long patientId,
                                    @RequestParam(required = false) String moderation,
                                    @RequestParam(required = false) String q,
                                    HttpSession session) {
        SessionUser me = sessionUser(session);
        List<Feedback> feedback = feedbackService.search(actor(session), doctorId, patientId, moderation, q);
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("feedback", feedback.stream().map(Dto::feedback).toList());
        body.put("count", feedback.size());
        body.put("averageRating", feedbackService.averageRating(
                me.isDoctor() ? me.getId() : doctorId));
        return body;
    }

    // UPDATE - Feedback Edit Page
    @PutMapping("/{id}")
    public Map<String, Object> edit(@PathVariable Long id, @Valid @RequestBody FeedbackForm form,
                                    HttpSession session) {
        Feedback feedback = feedbackService.edit(id, form, actor(session));
        return Map.of("message", "Feedback updated", "feedback", Dto.feedback(feedback));
    }

    // UPDATE - moderation: hide / restore
    @PostMapping("/{id}/hide")
    @RequireRole({UserRole.ADMIN, UserRole.DOCTOR})
    public Map<String, Object> hide(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                    HttpSession session) {
        String note = body == null ? null : body.get("note");
        Feedback feedback = feedbackService.hide(id, note, actor(session));
        return Map.of("message", "Feedback hidden from public view", "feedback", Dto.feedback(feedback));
    }

    @PostMapping("/{id}/restore")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> restore(@PathVariable Long id, HttpSession session) {
        Feedback feedback = feedbackService.restore(id, actor(session));
        return Map.of("message", "Feedback restored - visible again", "feedback", Dto.feedback(feedback));
    }

    // DELETE - permitted test feedback only
    @DeleteMapping("/{id}")
    @RequireRole(UserRole.ADMIN)
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        return Map.of("message", feedbackService.delete(id, actor(session)));
    }
}
