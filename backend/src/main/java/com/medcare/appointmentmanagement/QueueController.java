package com.medcare.appointmentmanagement;

import com.medcare.common.web.BaseController;
import com.medcare.accesscontrol.AccountService;
import com.medcare.common.domain.User;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Component 03 - Appointment Management (the waiting room).
 *
 * <p>The page layer of {@link QueueService}: it only passes the signed-in person
 * and the day to look at, and hands the answer straight back. The order of the
 * queue and the token numbers are worked out by the service.</p>
 */
@RestController
@RequestMapping("/api/queue")
public class QueueController extends BaseController {

    private final QueueService queueService;

    public QueueController(AccountService accountService, QueueService queueService) {
        super(accountService);
        this.queueService = queueService;
    }

    /** The clinic queue of a day - reception, the administrator and doctors. */
    @GetMapping
    public Map<String, Object> board(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long doctorId,
            HttpSession session) {
        return queueService.board(actor(session), date, doctorId);
    }

    /** A patient's own place in line. */
    @GetMapping("/my-place")
    public Map<String, Object> myPlace(@RequestParam(required = false) Long appointmentId,
                                       HttpSession session) {
        User me = actor(session);
        return queueService.myPlace(me, appointmentId);
    }
}
