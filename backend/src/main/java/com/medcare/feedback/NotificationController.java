package com.medcare.feedback;

import com.medcare.accesscontrol.AccountService;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.feedback.Notification;
import com.medcare.feedback.NotificationService;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Component 06 - Notification Inbox (every signed-in user sees their own inbox). */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController extends BaseController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService, AccountService accountService) {
        super(accountService);
        this.notificationService = notificationService;
    }

    // READ - Notification Inbox Page
    @GetMapping
    public Map<String, Object> inbox(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                     HttpSession session) {
        Long userId = sessionUser(session).getId();
        var notifications = unreadOnly ? notificationService.unread(userId) : notificationService.inbox(userId);
        return Map.of("notifications", notifications.stream().map(Dto::notification).toList(),
                "unreadCount", notificationService.unreadCount(userId),
                "count", notifications.size());
    }

    @GetMapping("/unread-count")
    public Map<String, Object> unreadCount(HttpSession session) {
        return Map.of("unreadCount", notificationService.unreadCount(sessionUser(session).getId()));
    }

    // UPDATE - mark read / unread
    @PostMapping("/{id}/read")
    public Map<String, Object> markRead(@PathVariable Long id, HttpSession session) {
        Notification notification = notificationService.markRead(id, sessionUser(session).getId());
        return Map.of("message", "Marked as read", "notification", Dto.notification(notification));
    }

    @PostMapping("/{id}/unread")
    public Map<String, Object> markUnread(@PathVariable Long id, HttpSession session) {
        Notification notification = notificationService.markUnread(id, sessionUser(session).getId());
        return Map.of("message", "Marked as unread", "notification", Dto.notification(notification));
    }

    @PostMapping("/read-all")
    public Map<String, Object> markAllRead(HttpSession session) {
        int updated = notificationService.markAllRead(sessionUser(session).getId());
        return Map.of("message", updated + " notification(s) marked as read");
    }

    // DELETE - read notifications may be cleared
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id, HttpSession session) {
        return Map.of("message", notificationService.delete(id, actor(session)));
    }
}
