# Component ownership and integration

All component branches start from the same shared foundation commit on main. Each contribution owns a disjoint set of source files, so the initial merges do not edit the same files. Existing cross-component APIs are preserved.

The four confirmed component commits use the requested GitHub usernames and their verified GitHub noreply addresses. IT26100051 is the committer and pushing account. These commits import the supplied existing code; they do not represent a reconstructed development history. The two unconfirmed components remain local, with staged source and no commit until ownership is confirmed.

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

Owner: not yet confirmed.

- `backend/src/main/java/com/medcare/availability/AvailabilityForm.java`
- `backend/src/main/java/com/medcare/availability/DoctorAvailability.java`
- `backend/src/main/java/com/medcare/availability/DoctorAvailabilityRepository.java`
- `backend/src/main/java/com/medcare/availability/ScheduleController.java`
- `backend/src/main/java/com/medcare/availability/ScheduleService.java`
- `frontend/js/views/availability.js`

## feedback-notification-management

Owner: not yet confirmed.

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

Database files, generated clinic records, build outputs, IDE state and dependency folders are excluded. The existing compiled frontend bundle contains all six components, so it is deliberately excluded from publication while two components have unconfirmed owners. Rebuild it after integration.

## Merge later

Once both remaining owners are confirmed, commit their staged files with their verified author identities and push those two branches. On an integration checkout, start from main and merge the six branches:

```sh
git switch main
git merge --no-ff patient-management
git merge --no-ff doctor-management
git merge --no-ff appointment-management
git merge --no-ff access-control-staff-management
git merge --no-ff doctor-availability-schedule-management
git merge --no-ff feedback-notification-management
npm --prefix frontend ci
npm --prefix frontend run build
mvn -f backend/pom.xml test
mvn -f backend/pom.xml package
```

The frontend bundle is ignored because it is generated; Maven packages the locally rebuilt bundle into the runnable jar. Do not expect any individual component branch or the foundation to compile or run before all dependencies are merged. No components have been merged into main as part of the initial publication.
