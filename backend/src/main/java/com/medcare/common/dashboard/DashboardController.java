package com.medcare.common.dashboard;

import com.medcare.accesscontrol.AccountService;
import com.medcare.appointmentmanagement.AppointmentService;
import com.medcare.common.dashboard.DashboardService;
import com.medcare.common.domain.User;
import com.medcare.common.web.BaseController;
import com.medcare.common.web.Dto;
import com.medcare.feedback.NotificationService;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Dashboard data for the signed-in role (Component 04). */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController extends BaseController {

    private final DashboardService dashboardService;
    private final AppointmentService appointmentService;
    private final NotificationService notificationService;

    public DashboardController(DashboardService dashboardService,
                               AppointmentService appointmentService,
                               NotificationService notificationService,
                               AccountService accountService) {
        super(accountService);
        this.dashboardService = dashboardService;
        this.appointmentService = appointmentService;
        this.notificationService = notificationService;
    }

    @GetMapping
    public Map<String, Object> dashboard(HttpSession session) {
        User user = actor(session);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("stats", dashboardService.statsFor(user));
        body.put("activity", dashboardService.activitySeries());
        body.put("upcoming", appointmentService.upcomingFor(user, 5).stream()
                .map(Dto::appointment).toList());
        body.put("notifications", notificationService.unread(user.getId()).stream()
                .limit(5).map(Dto::notification).toList());
        return body;
    }
}
