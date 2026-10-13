# Component ownership and integration

All component branches start from the same shared foundation commit on main. Each contribution owns a disjoint set of source files, so the initial merges do not edit the same files. Existing cross-component APIs are preserved.

All six component commits use the requested GitHub usernames and their verified GitHub noreply addresses. IT26100051 is the committer and pushing account. These commits import the supplied existing code; they do not represent a reconstructed development history. All components have been pushed and merged into main.

## patient-management

Owner: IT26100051.

- `backend/src/main/java/com/medcare/patientmanagement/Patient.java`
- `backend/src/main/java/com/medcare/patientmanagement/PatientController.java`
- `backend/src/main/java/com/medcare/patientmanagement/PatientForm.java`
- `backend/src/main/java/com/medcare/patientmanagement/PatientRepository.java`
- `backend/src/main/java/com/medcare/patientmanagement/PatientService.java`
- `frontend/img/people/patient-arun.jpg`
- `frontend/img/people/patient-kasun.jpg`
- `frontend/img/people/patient-maleesha.jpg`
- `frontend/img/people/patient-nimasha.jpg`
- `frontend/img/people/patient-suresh.jpg`
- `frontend/img/people/patient-thilini.jpg`
- `frontend/js/views/patients.js`

## doctor-management

Owner: IT26100271.

- `backend/src/main/java/com/medcare/doctormanagement/Doctor.java`
- `backend/src/main/java/com/medcare/doctormanagement/DoctorController.java`
- `backend/src/main/java/com/medcare/doctormanagement/DoctorForm.java`
- `backend/src/main/java/com/medcare/doctormanagement/DoctorRepository.java`
- `backend/src/main/java/com/medcare/doctormanagement/DoctorService.java`
- `frontend/img/people/doctor-fernando.jpg`
- `frontend/img/people/doctor-nawaz.jpg`
- `frontend/img/people/doctor-perera.jpg`
- `frontend/img/people/doctor-silva.jpg`
- `frontend/js/views/doctors.js`

## appointment-management

Owner: IT26100460.

- `backend/src/main/java/com/medcare/appointmentmanagement/Appointment.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/AppointmentController.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/AppointmentForm.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/AppointmentRepository.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/AppointmentService.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/QueueController.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/QueueService.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/WaitlistController.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/WaitlistEntry.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/WaitlistForm.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/WaitlistRepository.java`
- `backend/src/main/java/com/medcare/appointmentmanagement/WaitlistService.java`
- `backend/src/test/java/com/medcare/AppointmentRulesTest.java`
- `frontend/js/modules/booking.js`
- `frontend/js/modules/queue.js`
- `frontend/js/modules/visit.js`
- `frontend/js/modules/waitlist.js`
- `frontend/js/views/appointments.js`
- `frontend/js/views/waiting-room.js`
- `frontend/js/views/waitlist.js`

## access-control-staff-management

Owner: IT26100467.

- `backend/src/main/java/com/medcare/accesscontrol/AccountService.java`
- `backend/src/main/java/com/medcare/accesscontrol/AuthController.java`
- `backend/src/main/java/com/medcare/accesscontrol/Staff.java`
- `backend/src/main/java/com/medcare/accesscontrol/StaffController.java`
- `backend/src/main/java/com/medcare/accesscontrol/StaffForm.java`
- `backend/src/main/java/com/medcare/accesscontrol/StaffService.java`
- `backend/src/main/java/com/medcare/accesscontrol/UserRepository.java`
- `backend/src/main/java/com/medcare/common/audit/AuditLogService.java`
- `backend/src/main/java/com/medcare/common/config/WebConfig.java`
- `backend/src/main/java/com/medcare/common/dashboard/DashboardController.java`
- `backend/src/main/java/com/medcare/common/dashboard/DashboardService.java`
- `backend/src/main/java/com/medcare/common/security/AuthInterceptor.java`
- `backend/src/main/java/com/medcare/common/security/PasswordUtil.java`
- `backend/src/main/java/com/medcare/common/security/RequireRole.java`
- `backend/src/main/java/com/medcare/common/security/SessionUser.java`
- `frontend/img/people/staff-admin.jpg`
- `frontend/img/people/staff-kumari.jpg`
- `frontend/img/people/staff-sanduni.jpg`
- `frontend/js/views/administration.js`
- `frontend/js/views/dashboard.js`
- `frontend/login.html`

## doctor-availability-schedule-management

Owner: it26100420.

- `backend/src/main/java/com/medcare/availability/AvailabilityForm.java`
- `backend/src/main/java/com/medcare/availability/DoctorAvailability.java`
- `backend/src/main/java/com/medcare/availability/DoctorAvailabilityRepository.java`
- `backend/src/main/java/com/medcare/availability/ScheduleController.java`
- `backend/src/main/java/com/medcare/availability/ScheduleService.java`
- `frontend/js/views/availability.js`

## feedback-notification-management

Owner: IT26100002.

- `backend/src/main/java/com/medcare/feedback/Feedback.java`
- `backend/src/main/java/com/medcare/feedback/FeedbackController.java`
- `backend/src/main/java/com/medcare/feedback/FeedbackForm.java`
- `backend/src/main/java/com/medcare/feedback/FeedbackRepository.java`
- `backend/src/main/java/com/medcare/feedback/FeedbackService.java`
- `backend/src/main/java/com/medcare/feedback/Notification.java`
- `backend/src/main/java/com/medcare/feedback/NotificationController.java`
- `backend/src/main/java/com/medcare/feedback/NotificationRepository.java`
- `backend/src/main/java/com/medcare/feedback/NotificationService.java`
- `frontend/js/views/feedback.js`

## Shared foundation

The foundation contains Maven configuration, the application entry point, common domain/forms/exceptions, shared controllers and DTOs, document export, demo seeding, photo utilities, the portal shell, public website, styles, fonts, generic artwork, frontend dependencies and integration entry point, existing UI-check tools, and documentation. Some shared integration files reference component types which become available after merging all six contributions.

Database files, generated clinic records, build outputs, IDE state and dependency folders are excluded. With all six owners confirmed, the complete frontend bundle is included on main for offline operation. The shared Java report-export package is included as application source; only generated runtime documents are ignored.

## Completed integration

On 10 October 2026, patient-management, doctor-management, appointment-management, access-control-staff-management and feedback-notification-management were merged into main using separate merge commits. Their original author commits and branch names were preserved. This makes the original component authors eligible for GitHub's default-branch Contributors graph; statistics may take time to refresh.

On 13 October 2026, doctor-availability-schedule-management was merged into main, preserving the original it26100420 author commit. All six branches remain available. To run the integrated project, use main. The committed frontend bundle supports offline use; the npm steps below are needed only to rebuild it after frontend changes:

```sh
git switch main
git pull --ff-only
npm --prefix frontend ci
npm --prefix frontend run build
mvn -f backend/pom.xml test
mvn -f backend/pom.xml package
```

The frontend bundle is committed for offline operation, and Maven packages it into the runnable jar. All six component implementations and shared application source are now available on main.
