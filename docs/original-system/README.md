# MedCare — Medical Appointment Scheduling System

A complete, runnable implementation of all **six components** of the Medical Appointment
Scheduling System specification: a public clinic website plus a signed-in portal, backed by a
Java service layer with a **plain text document for every record**.

The project is split into two folders so that the code is easy to manage and to show in a viva:

```
medical-appointment-system/
├── frontend/   everything the browser loads  (HTML, CSS, JavaScript, photographs, fonts)
└── backend/    the Maven project             (Java, one package per component + shared code)
```

* Backend: Java 17, Spring Boot 3.3, Spring Data JPA, H2 database (file based)
* Front end: HTML + CSS + vanilla JavaScript, one file per page (`js/views/*`), lifted by real **npm libraries** (motion, Lenis,
  Swiper, Lucide, Floating UI, auto-animate, dayjs, qrcode) that are **bundled offline with esbuild** -
  the built bundle is committed, so nothing has to be installed to run the demo
* Data evidence: one formatted `.txt` document per component + an append-only activity log
* Access control: session based login with four roles (Administrator, Receptionist, Doctor, Patient)
* Photographs for every patient, doctor and staff member in the demonstration data

---

## 1. How to run it in IntelliJ IDEA

1. **Open the project**
   `File → Open…` and select the `backend` folder (it contains `pom.xml`). IntelliJ imports it as a
   Maven project automatically (if not: right-click `pom.xml` → *Add as Maven Project*).
   The website lives in the sibling `frontend` folder and is picked up automatically when the
   application starts - nothing has to be copied by hand.
2. **Set the JDK**
   `File → Project Structure → Project` → SDK = **JDK 17 or newer** (21 works too),
   language level 17.
3. **Wait for the Maven import to finish** (downloads Spring Boot once).
4. **Run**
   Open `src/main/java/com/medcare/MedicalAppointmentSystemApplication.java`
   and press the green ▶ button (or `Shift+F10`). *(See "Option B" below if you would rather run the
   packaged jar from the command line.)*
5. **Open the browser**
   Go to **http://localhost:8080** — the clinic home page opens. Use *Patient sign in* (or
   `http://localhost:8080/login`) to reach the portal.

### Option B - run the packaged jar (no IntelliJ needed)

```bash
mvn -f backend/pom.xml package          # builds backend/target/medical-appointment-system-1.0.0.jar
java -jar backend/target/medical-appointment-system-1.0.0.jar
```

Then open <http://localhost:8080>. Handy if you want to demonstrate the finished system on a machine
without an IDE. Add `--server.port=9090` (or any other argument) to change the port.

> The first start creates the database in `./data` and seeds demonstration data
> (4 doctors, 6 patients, 3 staff accounts, 215 availability slots, 10 appointments,
> 3 feedback entries) and writes all text documents into `./documents`.
>
> **Start fresh:** stop the application, delete the `data` folder, run again — everything is
> re-seeded cleanly.

### Demonstration logins (the login page has a "Demo accounts" link that fills them in for you)

| Role | Username | Password | What this account can do |
|---|---|---|---|
| Administrator | `admin` | `admin123` | Everything: staff, patients, doctors, availability, feedback moderation, reports, plus full appointment management |
| Receptionist | `reception` | `reception123` | Front desk: register patients, manage doctors/schedules, book walk-ins, **confirm / complete / reschedule / cancel any appointment**, reports |
| Doctor | `drsilva` | `doctor123` | Own schedule, **manage his own appointments (confirm, complete, no-show, reschedule, cancel)**, feedback about him, reports |
| Patient | `nimasha` | `patient123` | Own profile, book appointments, **cancel or reschedule their own upcoming appointments**, give feedback, inbox |

### Who can do what to an appointment

| Action | Administrator | Receptionist | Doctor | Patient |
|---|---|---|---|---|
| Book / reschedule | ✅ any | ✅ any | ✅ own | ✅ own (upcoming only) |
| Confirm | ✅ | ✅ | ✅ own | ❌ |
| **Complete (finish) the consultation** | ✅ | ✅ | ✅ own | ❌ |
| Mark no-show | ✅ | ✅ | ✅ own | ❌ |
| Reopen a completed appointment (correction) | ✅ | ✅ | ✅ own | ❌ |
| Cancel with a reason | ✅ any | ✅ any | ✅ own | ✅ own, **only before the appointment starts** |
| Delete the record | ✅ (approved test data only) | ❌ | ❌ | ❌ |

Every appointment row in the list (and the upcoming card on the dashboard) carries the actions the
signed-in user is allowed to perform - **Confirm**, **Complete**, **Cancel**, **Feedback** and **Manage** -
and the server re-checks each rule before it is applied, so the interface can never be tricked into
doing something a role is not allowed to do.

Other seeded accounts: doctors `drfernando`, `drperera`, `drnawaz` (password `doctor123`);
patients `kasun95`, `thilini`, `arun99`, `maleesha`, `suresh77` (password `patient123`);
receptionist `nurse` (`nurse123`).

---

## 2. Front end, branding and usability

The interface is built around the **MedCare logo** (shield + heart + hands + medical cross).

| Brand element | Value | Where it is used |
|---|---|---|
| Green | `#5DAE4F` (logo heart / hands / "Med") | logo art, accent stripes, badges, glows, gradients |
| Deep teal | `#2C8078` (shield outline + "Care") | gradient partner, sidebar, links, hero background |
| Action green | `#37802F → #256F68` gradient | primary buttons (chosen for accessible contrast with white text) |
| Headings font | **Poppins** (400/500/600/700) | headings, buttons, tabs, stat numbers, brand text |
| Interface font | **Inter** (variable, 100–900) | body text, tables, forms, notifications |

Both fonts are **self-hosted** from `/fonts` (88 KB total, no internet needed) — the app looks the
same on a machine with no internet connection, which also makes the marker's demo safe.

**Logo assets** (`src/main/resources/static/img/`) were produced from the supplied image:
`logo.png` (full lock-up for the login page), `logo-mark.png` (shield only, used in the sidebar and
splash screen), `logo-wordmark.png`, plus `favicon-32/64.png` and `apple-touch-icon.png`.
All of them have a transparent background.

**Three pages, written for patients rather than for programmers.**

| Page | Address | What is on it |
|---|---|---|
| Clinic home page | `/` | Announcement bar, sticky header, hero with a photograph collage and a symptom/speciality search, four quick-action tiles, a counting trust strip, speciality cards, the medical team with photographs and each doctor's **next free appointment**, a doctor **profile card** (qualifications, registration, room, fee and the times that can be booked straight away), a **Visit the clinic** section with the illustrated map and directions, facilities mosaic, patient reviews carousel, FAQ, call-to-action band, footer with opening hours - plus a mobile booking bar and a reading-progress line |
| Sign-in page | `/login` | Logo, clinic photograph, clinician card and a deliberately short form (username, password, remember-me) |
| Patient / staff portal | `/app` | The role-based workspace: dashboard, records, appointments, schedules, feedback and notifications |

**Photographs everywhere.** Every doctor, patient and staff member has a picture, shown in the
medical team list, next to every appointment, on each profile and in the side bar. Photographs are
kept in `frontend/img/people/`. (People registered later fall back to neat initials circles, the same
way real patient portals do.)

**No programming words anywhere in the website.** The six components are called by their everyday
names in the interface - *Patient records, Medical team, Appointments, Consulting hours, Patient
feedback, Staff accounts* - never "Component 01" or file names. Ports, folders and technical
messages appear only in the console window.

> `docs/design-preview.html` is a **single self-contained file** (logo + fonts embedded) that shows the
> login page, the dashboard, the component library and a sample text report — useful for the report or
> if you want to show the design without starting the server.

### The front-end libraries (npm + esbuild)

The interface is plain HTML/CSS/JavaScript served by the application - no internet needed at run time -
but the animations come from real, published npm packages:

| Package | Version | Used for |
|---|---|---|
| [motion](https://www.npmjs.com/package/motion) | 14.0.0 | every entrance, hover, stagger, count-up and chart animation |
| [lenis](https://www.npmjs.com/package/lenis) | 1.3.26 | smooth scrolling (clinic home page and the portal) |
| [swiper](https://www.npmjs.com/package/swiper) | 14.3.0 | the patient-reviews carousel |
| [lucide](https://www.npmjs.com/package/lucide) | 1.52.0 | the whole icon set (sidebar, buttons, tables, home page, sign-in page) |
| [@floating-ui/dom](https://www.npmjs.com/package/@floating-ui/dom) | 1.8.0 | pop-over placement (profile menu, FAQ popovers, chart tooltips) |
| [@formkit/auto-animate](https://www.npmjs.com/package/@formkit/auto-animate) | 0.10.0 | list re-ordering when a table is filtered or sorted |
| [dayjs](https://www.npmjs.com/package/dayjs) | 1.11.23 | human date labels ("Today", "in 2 hours") with the relative-time plugin |
| [qrcode](https://www.npmjs.com/package/qrcode) | 1.5.4 | the check-in code on each open appointment |
| [esbuild](https://www.npmjs.com/package/esbuild) | 0.28.2 (dev) | bundles those eight into one small file |

```bash
cd frontend
npm install          # once
npm run build        # -> js/vendor.js (664 kB, minified) + js/vendor.css
npm run watch        # rebuild while you work
```

`js/vendor.js` and `js/vendor.css` are **committed**, so the application runs on a machine that has
never heard of npm. The pages reach the bundle through one small facade, `window.MedCare`
(`frontend/js/vendor.entry.js`): `animate`, `inView`, `stagger`, `scroll`, `spring`, `cubicBezier`,
`hover`, `press`, `Lenis`, `autoAnimate`, `Swiper` + `swiperModules`, `createIcons`, `icons`,
`floating`, `dayjs`, `QRCode`. Every call site is guarded: if the bundle is ever missing the site
simply works without the animations instead of breaking.

### Motion (all of it respects `prefers-reduced-motion`)

| Animation | Where |
|---|---|
| Brand splash with the floating shield mark | first load of `/app` |
| Hero collage that floats, glass "next free appointment" card, brand headline | clinic home page |
| Scroll-triggered reveals, staggered cards, counting trust numbers | every section of the home page |
| Smooth scrolling (Lenis), reading-progress line, header shrinks after 40 px | home page |
| Autoplaying patient-reviews carousel with swipe and dots | home page reviews |
| Accordion FAQ, back-to-top button, slide-in mobile booking bar | home page |
| Page transition (fade + rise) with **staggered** cards and table rows | every portal page |
| SVG line chart that draws itself in, dots popping one after another | dashboard, last two weeks of appointments |
| Pop-over profile menu, sliding pill navigation | portal chrome |
| Counting-up numbers | dashboard statistics |
| Check-in code drawn on the appointment | every open appointment (QR of the reference number) |
| Tooltip that glides to the point you hover | dashboard activity chart (Floating UI) |
| Human time labels styled as soft pills | appointment tables, notification inbox |
| Table rows re-arranging softly when the list is filtered | every list screen (auto-animate) |
| Ripple on press | every button |
| Slide + glow on hover, animated active indicator | sidebar navigation, feature cards, stat cards |
| Pop-in dialog, fade-in backdrop, shake on validation error | modals, forms |
| Slide-in toast with a progress bar | all feedback messages |
| Pulse ring | unread notification badge, nav counter |
| Animated show/hide password, on-line focus rings | forms |

### Usability features

* **Role-aware menu** — you only ever see the pages your role can use (and the API refuses the rest).
* **Live search** with debounce on patients, doctors, staff, feedback and reports.
* **Highlighted server errors** — the exact field that failed is outlined, explained and scrolled to.
* **Show/hide password**, "remember my username", click-to-fill demo logins on the sign-in page.
* **Empty states** with a clear next step, plus loading spinners/skeletons instead of blank screens.
* **Confirm dialogs** for anything destructive and clear plain-English explanations for deletes vs. deactivations.
* **Keyboard**: `Esc` closes dialogs, sensible tab order, visible focus rings, `Ctrl/⌘ + P` prints a clean page.
* **Human time labels** - "Today at 09:25", "Tomorrow", "in 2 hours" instead of raw timestamps, on
  every appointment table and in the notification inbox.
* **Check-in code** - open a *Pending* or *Confirmed* appointment and the reference number is drawn as
  a check-in code the patient can show at the desk.
* **Smooth scrolling** (Lenis) on the clinic pages and inside the portal, plus a soft "back to top".
* **Responsive**: the sidebar becomes a slide-in drawer with a backdrop below 980 px; buttons collapse to icons;
  on a telephone the tables become cards, so no list has to be scrolled sideways.
* **Waiting room with token numbers** - every open visit of a day gets a token, urgent ones called first
  (**Appointments → Waiting room**). Staff see who is waiting, who has been seen and how long the clinic
  still needs; a patient sees *their own* place in line ("You are number 3, about 30 minutes to wait")
  on the dashboard and on the appointment itself.
* **Your own picture, everywhere** - every patient, doctor and staff member can upload a photograph
  (file, camera, drag-and-drop, circular crop or the clinic's own library) and it appears in the side bar,
  in every list, on the appointment, on the check-in pass and on the public clinic website. A brand new
  record automatically receives the matching default portrait, so no screen ever shows an empty box.

---

## 3. The six components

| # | Component | Pages in the app | Main classes |
|---|---|---|---|
| 01 | **Patient Management** | Register patient · Patient list & search · Patient profile · Profile update | `Patient`, `PatientForm extends UserForm`, `PatientService`, `PatientRepository` |
| 02 | **Doctor Management** | Register doctor · Doctor list & search · Doctor profile/edit | `Doctor`, `DoctorForm extends UserForm`, `DoctorService`, `DoctorRepository` |
| 03 | **Appointment Management** | Book appointment · Appointment list (with inline Confirm / Complete / Cancel) · Appointment details/manage · Reschedule & cancel · Waiting room with token numbers | `Appointment`, `AppointmentService`, `QueueService`, `AppointmentRepository`, `QueueController` |
| 04 | **Access Control & Staff** | Login · Dashboard · Staff registration · Staff management panel | `User`, `Staff`, `UserForm`, `AccountService`, `StaffService`, `AuthInterceptor` |
| 05 | **Doctor Availability & Schedule** | Create availability · Doctor schedule · Available slots list · Slot block/unblock | `DoctorAvailability`, `ScheduleService`, `DoctorAvailabilityRepository` |
| 06 | **Feedback & Notification** | Submit feedback · Feedback list/moderation · Feedback edit · Notification inbox | `Feedback`, `Notification`, `FeedbackService`, `NotificationService` |

### CRUD coverage

| Component | Create | Read | Update | Delete |
|---|---|---|---|---|
| 01 Patients | Register form | List/search, profile | Contact, address, emergency contact, status | Test records deleted; accounts with history **deactivated** |
| 02 Doctors | Register form | List/search, profile | Details, consultation duration, status | Unused records deleted; doctors with history deactivated (future slots blocked) |
| 03 Appointments | Book on a valid slot | Role-based lists, details, cancelled history, the day's queue | Confirm, complete, no-show, cancel with reason, reschedule, visit type (routine/urgent/follow-up) | Cancelled appointments kept as history; approved test data removable by admin |
| 04 Staff | Create admin/receptionist | Staff list/search, activity log | Profile, role, active status | Unused test accounts deleted; accounts with activity deactivated |
| 05 Availability | Create slot (or a whole window, auto-split by consultation duration) | Schedule list, available slots | Block/unblock, change time | Unused slots deleted; booked slots never deleted |
| 06 Feedback/Notifications | Submit feedback (completed visits only), notifications created automatically | Inbox, unread counters, feedback list | Edit feedback, hide/restore, mark read/unread | Permitted test feedback; only read notifications |

### OOP concepts demonstrated

* **Encapsulation** — every domain class keeps private state and exposes controlled methods:
  `User.applyActiveFlag()`, `Appointment.cancel(reason, actor)`, `Appointment.reschedule(slot, actor)`,
  `DoctorAvailability.block()/markBooked()/release()`, `Feedback.hide()/restore()`,
  `Patient.updateProfile()`, `Doctor.updateProfessionalDetails()`. Status fields have **no public setter**,
  so an invalid transition is impossible.
* **Inheritance** — `Patient`, `Doctor` and `Staff` all extend `User`
  (`@Inheritance(SINGLE_TABLE)`); `PatientForm`, `DoctorForm` and `StaffForm` all extend `UserForm`
  and reuse one validation + `applyTo(User)` routine.
* **Abstraction** — services hide the business rules from the web layer:
  `PatientService` (registration/validation), `AppointmentService` (availability, ownership, status rules),
  `ScheduleService` (overlap checking, allowed status changes), `FeedbackService`/`NotificationService`
  (eligibility, moderation, delivery), `AccountService` (login, password hashing, uniqueness).
* **Polymorphism** — `getAccountType()` / `getProfileSummary()` are abstract on `User` and overridden by each
  user type; `UserForm.applyTo(User)` works for any account type; `NotificationService.deliver(...)`
  builds role/event specific messages behind one method; `SlotStatus`/`Appointment.Status` carry
  their own behaviour (`isOpen()`, `isDeleteAllowed()`).
* **Information hiding** — controllers never write storage records or change statuses directly; they call
  service methods. Passwords are hashed (PBKDF2) and never leave the service layer — the JSON mapper
  `Dto` exposes only what the screen needs.

---

## 4. Text file input / output - the clinic documents (the evidence for marking)

Every action taken in the interface is written to readable text files in the **`output`** folder of the
project (open them straight from IntelliJ's project tree, or from the **Text file reports** page in the app,
which can preview and download them).

| File | Contents |
|---|---|
| `documents/component01-patients.txt` | Every patient: profile, contact, emergency contact, status, timestamps |
| `documents/component02-doctors.txt` | Every doctor: specialization, qualifications, consultation duration, fee, rating |
| `documents/component03-appointments.txt` | Every appointment: status, reason, notes, cancellation reason & who cancelled |
| `documents/component04-staff-accounts.txt` | Admin/receptionist accounts with role and permissions |
| `documents/component05-doctor-schedules.txt` | Every availability slot with its status (Available/Blocked/Booked) |
| `documents/component06-feedback.txt` | Feedback with rating, comments and moderation state |
| `documents/component06-notifications.txt` | In-app notifications and their read/unread state |
| `documents/audit-log.txt` | **Append-only**: one line per create/update/delete/login (who, when, what) |
| `output/reports/system-summary.txt` | All components combined: counts, recent audit trail, file inventory |
| `output/reports/login-activity.txt` | Successful and failed sign-in attempts |

Recommended demonstration flow: change a record in the UI → open the matching `.txt` in IntelliJ →
show the new line, then open `audit-log.txt` and show the matching audit entry.

---

## 5. REST API (used by the pages, handy for testing with Postman/curl)

| Method & path | Purpose | Allowed roles |
|---|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/change-password` | Session & account | everyone / signed in |
| `GET/POST /api/patients`, `GET/PUT/DELETE /api/patients/{id}` | Component 01 CRUD | staff (update own profile for patients) |
| `POST /api/patients/{id}/status?active=true|false` | Account status | Admin, Receptionist |
| `GET /api/patients/options` | Patient picker for booking | Admin, Receptionist, Doctor |
| `GET/POST /api/doctors`, `GET/PUT /api/doctors/{id}` | Component 02 CRUD | staff / own profile for doctors |
| `POST /api/doctors/{id}/status`, `DELETE /api/doctors/{id}` | Status, delete/deactivate | Admin |
| `GET/POST /api/appointments`, `GET /api/appointments/{id}` | Component 03 | role scoped |
| `GET /api/appointments/slots?doctorId=&from=` | Bookable slots | signed in |
| `POST /api/appointments/{id}/confirm\|complete\|no-show\|reopen\|cancel\|reschedule` | Lifecycle (complete = "finish the visit"; reopen = undo a completion) | role scoped, see the matrix in §1 |
| `GET/POST /api/slots`, `POST /api/slots/{id}/block|unblock|time`, `DELETE /api/slots/{id}` | Component 05 | Admin, Receptionist, Doctor |
| `GET/POST /api/feedback`, `GET /api/feedback/eligible`, `PUT /api/feedback/{id}`, `POST /api/feedback/{id}/hide|restore`, `DELETE /api/feedback/{id}` | Component 06 | role scoped |
| `GET /api/notifications`, `/unread-count`, `POST /read-all`, `POST /{id}/read|unread`, `DELETE /{id}` | Inbox | owner |
| `GET /api/staff`, `POST /api/staff`, `PUT /api/staff/{id}`, `POST /api/staff/{id}/status`, `DELETE /api/staff/{id}`, `GET /api/staff/activity` | Component 04 | Admin |
| `GET /api/reports`, `GET /api/reports/{file}/content`, `GET /api/reports/{file}/download`, `POST /api/reports/refresh` | Text file evidence | Admin, Receptionist, Doctor |
| `GET /api/dashboard` | Dashboard numbers | signed in |

---

## 6. Project structure

```
medical-appointment-system/
├── README.md
├── docs/                                     MARKING-GUIDE.md, TEST-EVIDENCE.md, design-preview.html
│
├── tools/ui-checks/                          jsdom interface, safety and booking checks (docs/TEST-EVIDENCE.md §9-§11)
│
├── frontend/                                 EVERYTHING THE BROWSER LOADS
│   ├── index.html                            public clinic home page
│   ├── login.html                            sign-in page
│   ├── app.html                              signed-in portal shell
│   ├── package.json · build.mjs              npm toolchain: bundles the libraries (esbuild)
│   ├── css/styles.css                        brand theme, layout, animations
│   ├── js/vendor.entry.js                    the only file that imports npm packages
│   ├── js/vendor.js · js/vendor.css          the built bundle (committed - no npm needed to run)
│   ├── js/home.js                            home page: doctors, specialities, search, reviews
│   ├── js/app.js                             portal shell: sign-in, side bar, router, shared helpers
│   ├── js/views/                             ONE FILE PER PAGE  (see the table below)
│   │      dashboard.js  patients.js  doctors.js  appointments.js  waiting-room.js
│   │      availability.js  feedback.js  administration.js
│   ├── js/modules/                           the pieces the pages share
│   │      faces.js         round photographs, initials, person cells
│   │      photo-picker.js  the profile picture window (file, camera, clinic library, crop)
│   │      booking.js       the booking desk (steps, day rail, free times, confirmation)
│   │      visit.js         check-in pass, visit summary, earlier visits, count-down, priority pill
│   │      queue.js         the waiting room board and the patient's place in line
│   │      labels.js        room and doctor wording ("Room 12", never "Room Room 12")
│   │      search.js        the search box and the searchable pickers used by every page
│   ├── fonts/                                Poppins + Inter (self-hosted, works offline)
│   └── img/                                  logo, favicons, reception photograph,
│                                             people/  <- 13 photographs of the clinic's people
│
├── backend/                                  THE MAVEN PROJECT
│   ├── pom.xml                               also packages ../frontend into the jar as static/
│   └── src/
│       ├── main/java/com/medcare/
│       │   ├── MedicalAppointmentSystemApplication.java
│       │   │
│       │   ├── patientmanagement/            COMPONENT 1  Patient Management
│       │   │      Patient · PatientRepository · PatientService · PatientForm · PatientController
│       │   ├── doctormanagement/             COMPONENT 2  Doctor Management
│       │   │      Doctor · DoctorRepository · DoctorService · DoctorForm · DoctorController
│       │   ├── appointmentmanagement/        COMPONENT 3  Appointment Management
│       │   │      Appointment · AppointmentRepository · AppointmentService · AppointmentForm · AppointmentController
│       │   ├── accesscontrol/                COMPONENT 4  Access Control & Staff Management
│       │   │      Staff · UserRepository · AccountService · StaffService · StaffForm · AuthController · StaffController
│       │   ├── availability/                 COMPONENT 5  Availability & Schedule
│       │   │      DoctorAvailability · DoctorAvailabilityRepository · ScheduleService · AvailabilityForm · ScheduleController
│       │   ├── feedback/                     COMPONENT 6  Feedback & Notifications
│       │   │      Feedback · Notification · repositories · FeedbackService · NotificationService · forms · controllers
│       │   │
│       │   └── common/                       shared by all six components
│       │          domain/      User (abstract), UserRole            - the inheritance root
│       │          form/        UserForm (shared base of every form)
│       │          exception/   BusinessRuleException, AccessDeniedException, ResourceNotFoundException
│       │          security/    PasswordUtil, SessionUser, RequireRole, AuthInterceptor
│       │          documents/   OutputFile, TextFileService, DataExportService, ReportController
│       │          audit/       AuditLogService
│       │          dashboard/   DashboardService, DashboardController
│       │          config/      WebConfig, DemoDataSeeder
│       │          web/         BaseController, Dto, PageController, PublicController, GlobalExceptionHandler
│       │
│       ├── main/resources/application.properties
│       └── test/java/com/medcare/AppointmentRulesTest.java    10 rule tests
│
├── data/                                     H2 database (created on first run)
└── documents/                                the text documents (created on first run)
    ├── patient-records.txt      doctor-records.txt        appointment-records.txt
    ├── staff-accounts.txt       doctor-schedules.txt      waiting-list.txt
    ├── patient-feedback.txt     notification-inbox.txt    activity-log.txt
    └── reports/  clinic-summary.txt · sign-in-activity.txt
```

### Which file holds which page

| Page / window | File |
|---|---|
| Sign-in, side bar, router, toasts, windows, tables, formatters, the signed-in user | `frontend/js/app.js` |
| Dashboard (counters, next visit, your place in line, activity, chart) | `frontend/js/views/dashboard.js` |
| Patient register / list / profile / edit | `frontend/js/views/patients.js` |
| Doctor register / list / profile / edit | `frontend/js/views/doctors.js` |
| Book, appointment list, appointment window, cancel, reschedule, complete, check-in pass | `frontend/js/views/appointments.js` |
| Waiting room (tokens of the day) | `frontend/js/views/waiting-room.js` |
| Waiting list (join, offer a freed time, leave) | `frontend/js/views/waitlist.js` |
| Consulting hours: add, weekly schedule, block/unblock, change time | `frontend/js/views/availability.js` |
| Feedback form, review list, notification inbox | `frontend/js/views/feedback.js` |
| Staff accounts, my account, clinic documents | `frontend/js/views/administration.js` |

Every page is built as a small factory: `js/app.js` hands it the shared helpers
(`api`, `toast`, `modal`, the formatters, the faces...) plus `links`, which lets one page
open another page's window without importing it directly. The whole front end therefore
stays a handful of readable files, and each page can be found by name.

### Where to look during the viva

| Component | Open this folder | Class to talk about first |
|---|---|---|
| 1 Patient Management | `backend/src/main/java/com/medcare/patientmanagement/` | `PatientService` (rules) · `Patient` (data) |
| 2 Doctor Management | `com/medcare/doctormanagement/` | `DoctorService` · `Doctor` |
| 3 Appointment Management | `com/medcare/appointmentmanagement/` | `AppointmentService` · `Appointment` |
| 4 Access Control & Staff | `com/medcare/accesscontrol/` | `AccountService` · `AuthController` |
| 5 Availability & Schedule | `com/medcare/availability/` | `ScheduleService` · `DoctorAvailability` |
| 6 Feedback & Notifications | `com/medcare/feedback/` | `FeedbackService` · `NotificationService` |
| Shared / OOP basics | `com/medcare/common/` | `User` → `Patient`/`Doctor`/`Staff` inheritance, `UserForm` → `PatientForm`/`DoctorForm`/`StaffForm` |

---

## 7. Configuration

`src/main/resources/application.properties`

```properties
server.port=8080                          # change if the port is busy
spring.datasource.url=jdbc:h2:file:./data/medcare
app.output.dir=output                     # where the text files are written
app.seed.demo-data=true                   # false = start with an empty database
app.audit.enabled=true                    # false = do not write the audit log
spring.h2.console.enabled=true            # http://localhost:8080/h2-console (JDBC: jdbc:h2:file:./data/medcare)
```

**If port 8080 is busy** the application prints "Port 8080 was already in use" — set `server.port=8081`
(or stop the other process). Look at the H2 console (`user = sa`, empty password) if you want to show the
stored tables during the demo.

---

## 8. Automated tests

`src/test/java/com/medcare/AppointmentRulesTest.java` holds **10 rule tests** that run against a private
in-memory database (they never touch your demo data):

```bash
mvn test
```

They cover: a patient cancelling their own upcoming appointment (reason recorded, slot released),
a patient *not* being able to cancel an appointment that has already taken place (while staff still can),
cancelled appointments staying in history and never moving on again, reopening a completed appointment
(blocked once the patient has left feedback), double booking, overlapping slots, invalid slot windows,
and booked slots being protected from blocking or deletion.

The **interface** has its own automated checks (`tools/ui-checks/`, jsdom - start the application first):

| Script | Checks | What it proves |
|---|---|---|
| `node features.js` | 29 | sign-in page (icons, password toggle, no emoji), the doctor profile card, the "visit the clinic" section, the check-in code, the chart tooltip, human date labels |
| `node premiumcheck.js` | 49 | the clinic home page end to end (doctors, search, carousel, FAQ, scroll effects, images) plus the portal as patient and admin |
| `node uitest.js` | 40 screens | every menu entry for all four roles renders with data and zero console errors |
| `node audit.js` | 49 | the three pages as files: duplicate identifiers, missing pictures, unknown icon names, unlabelled fields, template leftovers, technical wording, undefined stylesheet variables, nothing loaded from the internet |
| `node signin.js` | 25 | the sign-in page driven like a visitor: password show/hide, demonstration accounts, a wrong password, a right password, the remembered username |
| `node round3.js` | 37 | the header button on hover, the clinic documents being the administrator's alone, the search boxes, the booking pickers, and the rules that keep the page moving steadily |
| `node waitlist.js` | 50 | the waiting list end to end: joining, seeing only your own places, the clinic offering a free time, the notification, a cancelled appointment being offered to the person waiting longest, booking closing the place, and that file's text output (run with `--read-only` against a working copy — 31 checks) |
| `node safety.js [address]` | 24 | who may see what (11 addresses × 4 roles), awkward and damaged requests, double booking, booking under another name, early feedback, and hostile text in a record shown safely on six screens |
| `node bookflow.js <user> <pass> [existing\|new]` | - | books an appointment through the real page as a patient, or as the front desk for a registered patient or a brand-new walk-in |
| `node homecheck.js` · `cssparse.js` · `iconnames.js` | - | home page counts, stylesheet parses cleanly, every icon name exists in the bundle |

## 9. Notes for the demonstration

* The **Dashboard** adapts to the signed-in role (patient, doctor, staff).
* The **bell** in the top bar shows unread notifications and refreshes every 30 seconds; booking,
  confirming, cancelling, rescheduling and completing an appointment automatically create notifications
  for the patient and the doctor.
* **Availability** prevents double booking: overlapping windows are rejected, booked slots cannot be
  blocked or deleted, and cancelling/rescheduling an appointment releases the slot immediately.
* **Delete rules** follow the specification: test records without history are removed, real accounts with
  history are deactivated (and the audit trail keeps the evidence), and an administrator cannot delete
  themselves or the last active administrator.
* Use the **Text file reports** page to open and download any generated file during the demo.
