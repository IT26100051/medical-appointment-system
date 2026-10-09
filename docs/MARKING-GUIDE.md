# Marking guide — where to show each requirement

> **Every path below is inside `backend/src/main/java/com/medcare/`.** The six components each have
> their own package (`patientmanagement`, `doctormanagement`, `appointmentmanagement`,
> `accesscontrol`, `availability`, `feedback`) and everything they share sits in `common/`.
> The website itself is completely separate, in the top-level `frontend` folder.

A quick script for demonstrating the project. Log in as `admin / admin123` unless stated otherwise.

---

## A. Component by component (CRUD + UI + OOP)

### Component 01 — Patient Management
| Requirement | Where to demonstrate |
|---|---|
| Create: register a patient | Sidebar → **Patients → Register a patient** → fill the form → *Register patient* → open `documents/patient-records.txt` and show the new block |
| Read: search/list patients | **Patient list & search** → type "nim" in the search box (live filtering), switch status filter, click **👁️ Profile** |
| Read: logged-in patient profile | Log in as `nimasha / patient123` → sidebar → **My profile** |
| Update: contact, address, emergency contact, account status | As admin: **Patient list → ✏️ Edit** (change phone/address/emergency contact/active flag). As patient: **My profile → Update profile** (a patient cannot change their own status — enforced server-side) |
| Delete: test records vs real accounts | Delete a patient **without** history → record is deleted. Delete a patient **with** history → the system **deactivates** instead and says so (history preserved). Deleting is blocked while pending/confirmed appointments exist |
| Encapsulation | `patientmanagement/Patient.java` — private fields, `updateProfile(...)` guarded; `User.applyActiveFlag(Boolean)` |
| Inheritance | `patientmanagement/PatientForm.java` line 1: `extends UserForm` |
| Abstraction | `patientmanagement/PatientService.java` holds validation + the delete/deactivate rule; `patientmanagement/PatientController.java` is thin |

### Component 02 — Doctor Management
| Requirement | Where to demonstrate |
|---|---|
| Create: name, specialization, qualifications, consultation duration | **Our doctors → Register a doctor** (try duration 5–120; 500 is rejected with a message) |
| Read: search/list + doctor profile | **Doctor list & search** → filter by specialization/status → **👁️ Profile** shows info, next open slots and patient feedback |
| Update: details, consultation duration, account status | **✏️ Edit** as admin; sign in as `drsilva / doctor123` → **My profile → Update profile** (doctor can edit own profile, not own status) |
| Delete | Delete an unused doctor → removed with its slots. Delete a doctor with history → **deactivated** and future slots blocked |
| Encapsulation | `doctormanagement/Doctor.java` — `updateProfessionalDetails(...)` validates the duration |
| Inheritance | `doctormanagement/DoctorForm.java extends UserForm` |
| Polymorphism | `UserForm.applyTo(User)` is called with a `Doctor` from a `UserForm` reference |

### Component 03 — Appointment Management
| Requirement | Where to demonstrate |
|---|---|
| Create: book on a valid available slot | **Book appointment** → pick patient (staff) / doctor → slot grid appears → choose a slot → book. Try booking the same slot twice → rejected |
| Who the visit is for | A **patient** sees *"This visit is booked in your own name."* — nothing to choose, and the server refuses a request that names somebody else (*"You can only book appointments for yourself"*). Staff see the picker: an existing patient **or** *"The patient is new"* (name + telephone are enough; the register record is created at that moment). Tests 11–12 in `AppointmentRulesTest` |
| Read: role-based lists + cancelled history | As admin: all appointments. As `drsilva`: only his. As `nimasha`: only hers. Filter status = *Cancelled* to show history |
| Update: confirm, complete, cancel with reason, reschedule | **Manage** on any appointment → Confirm → Complete ("finish" the visit, with notes) → Reopen if a completion was a mistake → Reschedule (pick another slot) → Cancel (reason required, appointment is kept). No-show is available on confirmed appointments |
| Role-based lifecycle (who may finish/manage what) | Admin, receptionist and doctor all get **Confirm / Complete / Manage** straight on the row: as `admin` or `reception` on every appointment, as `drsilva` on his own. A **patient only gets Cancel**, and only on their own appointment that has not started yet. Try `nimasha` → cancel one of `drsilva`'s other patients' appointments with curl: **403 "This appointment belongs to another patient"** |
| Cancelled appointments stay in history | Patient cancels their own upcoming visit (person icon menu → *Appointments* → **Cancel** → type a reason) → status becomes *Cancelled*, the row stays in the list for everyone, `cancelledBy` and the reason are shown in the details, the slot is freed for re-booking, and the cancellation lands in `output\audit_trail.txt` |
| Guard rails you can show | Cancel a *completed* visit → "A completed appointment cannot be cancelled". Reopen after the patient has left feedback → "This appointment already has patient feedback..." (the feed-back must stay linked to a real visit). Confirm twice → "Cannot confirm an appointment that is Confirmed" |
| Waiting room with token numbers (real-world feature) | Sidebar → **Appointments → Waiting room**. Every open visit of the day is listed in the order the clinic will actually call it: urgent visits first, then by appointment time. Each patient gets a **token**, the board shows *Now serving*, how many are still waiting, how many have been seen and how many minutes of consultations are left. Press **Refresh**, change the day or the doctor. As `nimasha`: the dashboard shows *Your place in line* ("You are number 2 in line, with 1 patient ahead of you") and the same note appears in the appointment window |
| Waiting list: a patient who cannot find a time joins the doctor's list (real-world feature) | Sidebar → **Appointments → Waiting list**. As `nimasha`: the page lists only her own places, with the days she can come and the offered time. Join from **Book an appointment** → choose a doctor → when that doctor has no free time in the next three weeks the invitation appears (*"No free time with Dr. …?"*) → **Join the waiting list** → choose "I can come from" → *Take my place on the list*. As `admin`: the same page is a table of who is waiting for whom, with **Offer a free time** (a list of that doctor's free times) and a cross to take somebody off the list. Opening `documents/waiting-list.txt` shows the same information as plain text |
| A freed time is offered automatically (the part that makes it feel real) | As `admin`: **Appointments** → open an appointment of the doctor somebody is waiting for → **Cancel** with a reason. The patient waiting longest *whose own dates suit that day* immediately gets the offer: their place changes to *A time offered*, the offered time appears on the waiting list, a notification lands in their inbox (*"A time has opened up with Dr. …"*) and their dashboard shows a red notice *"A time has opened up for you"* with a button to the page, where **Book this time** opens the booking desk on that exact slot. Booking it turns the place into *Booked*. A day outside their dates is **not** offered to them — the rule `WaitlistEntry.suits(day)` decides, so nobody is told about a time they cannot attend |
| Visit type / priority | **Manage** an appointment → *Change priority* (Routine · Urgent · Follow-up). Urgent visits move to the front of the waiting room and are marked in red |
| Check-in pass | **Manage** an appointment → **Check-in pass**: the reference number is drawn as a code, with *Save* (plain text file) and *Print* |
| Visit summary the patient can read | **Complete** a consultation and fill *What was found / advice / follow-up*: the patient sees "Your visit summary" in the appointment window, and earlier visits are listed as a timeline |
| Delete | Cancelled/completed records can be deleted **only by admin** as approved test data; active appointments cannot be deleted — you must cancel first (that is what keeps the history) |
| Encapsulation | `appointmentmanagement/Appointment.java` — `confirm()`, `cancel(reason, actor)`, `complete()`, `reopen()`, `reschedule(slot, actor)`; status has no setter |
| Abstraction / information hiding | `appointmentmanagement/AppointmentService.java` — availability check, ownership check, status rules; controllers never write records directly |
| OOP in the waiting list | `appointmentmanagement/WaitlistEntry.java` keeps its own state (`offer`, `markBooked`, `cancel`, `suits(day)` — no setter for the state); `WaitlistService.java` holds who may join, see, offer or close a place; `WaitlistController.java` only answers HTTP; both forms extend the shared `UserForm`/request classes the same way the rest of the system does |

### Component 04 — Access Control & Staff Management
| Requirement | Where to demonstrate |
|---|---|
| Login | `/login` page (logo, clinic photograph, clinician card); the *Demo accounts* link fills a username in for quick marking |
| Role-based access | Try to open **Staff management** as receptionist/doctor/patient — the menu hides it and the API answers *403* |
| Create staff | **Administration → Staff management → Create staff account** (Administrator or Receptionist) |
| Read staff + activity | Staff table; second tab **Activity log** reads `documents/activity-log.txt` |
| Update staff profile / role / status | **✏️ Edit** — change designation, employee code, role, active flag; **Deactivate** button |
| Delete | Unused account → deleted; account with recorded activity → deactivated so the audit trail stays intact. Cannot delete/deactivate yourself or the last active administrator |
| Encapsulation | `common/domain/User.java` — private fields, `changePassword`, `applyActiveFlag`; password hashed with PBKDF2 in `common/security/PasswordUtil.java` |
| Abstraction | `common/security/AuthInterceptor.java` + `@RequireRole` — role checks live in one component, not in the pages |
| Polymorphism | one account workflow (`AccountService`, `UserForm`) serves admin, receptionist, doctor and patient |

### Component 05 — Doctor Availability & Schedule Management
| Requirement | Where to demonstrate |
|---|---|
| Create availability | **Create availability** → doctor, date, 09:00–12:00 (tick *split into consultation slots*) → creates one slot per consultation duration |
| Overlap prevention | Try to create a slot overlapping an existing one → rejected with the clashing time |
| Read: schedule + available slots | **Doctor schedule** (filter by doctor/date/status); the booking page shows only *Available* slots |
| Update: block/unblock, change time | **🚫 Block** (reason), **✅ Unblock**, **🕒 Change time** |
| Delete | Unused (available/blocked) slots can be deleted; booked slots cannot — "reschedule through Appointment Management" |
| Encapsulation | `availability/DoctorAvailability.java` — `block/unblock/markBooked/release/changeTime` keep status and data together |
| Abstraction | `availability/ScheduleService.java` — overlap check (`countOverlapping`), clinic-hours check, past-date check |
| Polymorphism | callers use one schedule API; `SlotStatus` decides bookable/delete-allowed behaviour |

### Component 06 — Feedback & Notification Management
| Requirement | Where to demonstrate |
|---|---|
| Create feedback | As `nimasha / patient123` → **Submit feedback** → only *completed* appointments are offered → rate with stars → submit |
| Eligibility rule | Try to submit twice for the same appointment → rejected ("already submitted") |
| Create notifications | The booking/confirm/reschedule/cancel/complete actions in Component 03 create them automatically — show the bell badge on the patient's screen |
| Read feedback + ratings | **Feedback & moderation** — list, average rating, per doctor |
| Read inbox + unread count | **Notification inbox** (and the top-bar bell) |
| Update: edit / hide / restore, mark read/unread | As admin edit any feedback; as the reviewed doctor **🙈 Hide** with a note; as admin **♻️ Restore**. In the inbox: read/unread toggles, *Mark all read* |
| Delete | Admin may delete feedback (logged in the audit trail); unread notifications must be marked read before deleting |
| Encapsulation | `feedback/Feedback.java`, `feedback/Notification.java` — state changes only through their own methods |
| Abstraction | `FeedbackService` (eligibility/moderation) and `NotificationService` (delivery) |
| Polymorphism | `NotificationService.deliver(...)` builds a different message per `Notification.Type` behind one interface |

---

## A2. Front end quality / branding (if the rubric awards marks for the interface)

**Clinic home page** — open `http://localhost:8080/`: an announcement bar and a sticky header that
shrinks as you scroll, a hero with a photograph collage and a glass "next free appointment" card, a
symptom search box (type *skin* or *heart* and watch the medical team filter itself), four quick-action
tiles, a counting trust strip, speciality cards built from the doctors themselves, the medical team with
photographs, qualifications, fees and each doctor's **next free appointment**, a facilities mosaic, the
**patient reviews carousel** (filled from the clinic's own published feedback), an FAQ accordion, a
call-to-action band, a **"Visit the clinic"** section (exterior photograph, the illustrated map of the
building, three numbered directions and the taxi/ambulance notes) and a full footer with address,
telephone number and opening hours. On a phone a booking bar slides in at the bottom.

Every doctor card opens a **profile card**: the cover photograph, qualifications, SLMC registration
number, consulting room, consultation length, fee and the next free times, and any of those times can
be booked on the spot.

**Sign-in page** — open `http://localhost:8080/login`: clinic logo, photograph of the reception desk,
a small clinician card (Dr. Ruvini Fernando · Dermatologist, with a live pulse dot) and a live
"<number> specialists on duty" chip that is read from the clinic. The password field has an **eye
toggle** that swaps between `eye` and `eye-off` and updates its accessible label, and the form shows
sign-in progress and field errors in plain clinical wording. Nothing technical about the project is shown
to the visitor any more; the demonstration usernames sit behind the *Demo accounts* link so the page
still looks like a real product. All images and fonts are served from `static/img` and `static/fonts`,
so it works with no internet connection.


| Requirement | Where to demonstrate |
|---|---|
| Logo integrated into the product | Login hero (full lock-up), sidebar brand mark, browser tab favicon, first-load splash screen |
| Consistent brand theme | Green `#5DAE4F` + teal `#2C8078` taken straight from the logo; primary buttons use the darker `#37802F → #256F68` gradient so white label text stays readable (WCAG AA) |
| Professional typography | **Poppins** for headings/buttons/numbers, **Inter** for interface text and tables - both self-hosted, so nothing depends on the internet |
| Smooth animation | Scroll-triggered reveals, floating hero collage, counting trust numbers, smooth scrolling with Lenis (home page and portal), autoplaying review carousel (Swiper), accordion FAQ, doctor profile card that glides open, page transitions with staggered cards and table rows, an SVG chart that draws itself in and shows a tooltip that follows the pointer, counting-up dashboard numbers, lists that re-arrange softly when they are filtered (auto-animate), "Today / in 2 hours" time pills, button ripples, hover lift, slide-in sidebar, pop-in dialogs, toasts with a progress bar, pulsing notification badge, Lucide icons throughout - all of it switched off automatically when the operating system asks for reduced motion |
| Every appointment is check-in ready | Open any *Pending* or *Confirmed* appointment in the portal: the reference number is drawn as a **check-in code** with instructions for the patient; cancelled and completed visits do not show it |
| Modern front-end tooling (bonus) | The libraries come from **npm** (motion, lenis, swiper, lucide, @floating-ui/dom, @formkit/auto-animate, dayjs, qrcode) and are bundled with **esbuild**: `cd frontend && npm install && npm run build`. The built `js/vendor.js` (664 kB, minified) is committed, so the demo runs without npm or internet |
| User-friendly behaviour | Role-aware menu, live search, server errors highlighted on the exact field, show/hide password, remember username, click-to-fill demo accounts, empty states with a next step, confirmation dialogs, loading indicators |
| Responsive layout | Resize the window below 980 px: the sidebar turns into a slide-in drawer, buttons collapse to icons, grids become a single column |
| Accessibility | Keyboard focus rings, `Esc` closes dialogs, semantic labels, colour contrast checked, print stylesheet |
| Design preview file | `docs/design-preview.html` - one self-contained page showing login, dashboard, component library and a text report (open it in any browser, no server needed) |
| Signs in | The sign-in page carries the clinic logo, one photograph of the reception, the form and the four demonstration accounts behind *Demo accounts*. Nothing else — no clinician card, no second form |
| Clinic documents | **Clinic documents** is in the administrator's own menu only; the front desk, doctors and patients do not see it, the portal refuses the page if the address is typed, and the server answers `403` to any of them |
| Searching and the keyboard | Every search is the same rounded box with a magnifier, a clear cross and the `/` shortcut; the booking desk's doctor and patient lists are searchable pickers with photographs. **g** then a letter jumps to a page, **?** lists the shortcuts for that role |
| Where the front-end code lives | `frontend/index.html` (clinic home page), `frontend/login.html`, `frontend/app.html` (portal shell), `frontend/js/app.js` (portal shell: side bar, router, shared helpers), **`frontend/js/views/`** - one file per page (`dashboard.js`, `patients.js`, `doctors.js`, `appointments.js`, `waiting-room.js`, `waitlist.js`, `availability.js`, `feedback.js`, `administration.js`), **`frontend/js/modules/`** - the shared pieces (`faces.js` round photographs, `photo-picker.js` the picture window, `booking.js` the booking desk, `visit.js` the check-in pass and visit summary, `queue.js` the waiting room board, `waitlist.js` joining a doctor's waiting list, `labels.js` room/doctor wording), `frontend/js/home.js` (home page logic), `frontend/js/vendor.entry.js` + `frontend/build.mjs` (the npm bundle), `frontend/css/styles.css` (theme, layout, animations) |
| Profiles look after themselves | Every new patient, doctor or staff account receives a **default portrait** (a male or female figure drawn from the clinic's own colours, or the clinic's brand mark for an administrator). Anybody can then upload their own picture (file, camera, drag-and-drop or the clinic library) with a **circular crop**: *Change picture* on your profile, in the side bar menu, or on the *My account* page. Removing it puts the default portrait back |
| The waiting room (real clinic behaviour) | **Appointments → Waiting room**: today's clinic with a **token number** for every patient, *Now serving*, waiting/seen counts and the minutes of consultations still to come; the patient's own dashboard shows *Your place in line* |

> Tip: demonstrate the animations by navigating between pages (watch the cards stagger in), clicking a
> primary button (ripple), booking an appointment (toast slides in with the progress bar), typing in the
> symptom search (the doctor cards glide instead of jumping) and hovering the dashboard chart (the
> tooltip follows the pointer). For the nicest single moment, click **Profile** on a doctor card on the
> home page and let the profile card open with its photograph.

---

## B. Quick "data in / data out" demonstration (2 minutes)

1. Register a patient in the UI → switch to IntelliJ → open `documents/patient-records.txt` → the record is there.
2. Book an appointment → `documents/appointment-records.txt` shows it with status *Pending*.
3. Confirm it → the same file now shows *Confirmed*; `doctor-schedules.txt` shows the slot as *Booked*.
4. Cancel it with a reason → the appointment stays in the file as *Cancelled* with the reason, and the slot returns to *Available*.
5. Join a doctor's waiting list, then cancel somebody's appointment with that doctor → `documents/waiting-list.txt`
   shows the place, the offered time and how it ended, and the summary counts who is waiting.
6. Open `documents/activity-log.txt` → every one of those steps appears as one line: timestamp, component, action, actor, details.
7. Open `documents/reports/clinic-summary.txt` → counts for all six components.
8. Optional: show the same files from the app itself under **Clinic documents** (preview + download) — every
   file on that page opens and downloads for the administrator.

---

## C. Likely exam questions and where the answer lives

* *"Show me encapsulation."* → `appointmentmanagement/Appointment.java` (no status setter, only lifecycle methods).
* *"Show me inheritance."* → `Patient/Doctor/Staff extends User`; `PatientForm/DoctorForm/StaffForm extends UserForm`.
* *"Show me abstraction."* → `PatientService`, `ScheduleService`, `AppointmentService`, `AccountService`.
* *"Show me polymorphism."* → `User.getProfileSummary()` overridden per type; `UserForm.applyTo(User)`; `NotificationService.deliver(...)`.
* *"How do you prevent double booking?"* → `ScheduleService.create()` overlap check + `AppointmentService.book()` slot status check; the slot row is marked **BOOKED** in the same transaction.
* *"Why don't you delete cancelled appointments?"* → they are the appointment history; deletion is restricted to approved test data by an administrator, and the rule is enforced in `AppointmentService.delete()`.
* *"How is the password stored?"* → PBKDF2-HMAC-SHA256 with a random salt (`common/security/PasswordUtil.java`); the hash never reaches the browser (`common/web/Dto.java`).
* *"Where does the design come from?"* → the palette is sampled from the logo (`#5DAE4F` green, `#2C8078` teal) and the typography matches it (Poppins + Inter); `static/css/styles.css` holds the whole theme in CSS variables at the top of the file.
