import { roomLabel } from './labels.js';
/* =============================================================================
   MedCare front end - the booking desk
   -----------------------------------------------------------------------------
   Component 03 (Appointment Management) - the part patients and receptionists
   use most: choosing a doctor, seeing the free times a day at a time, and
   confirming the visit.  The layout follows what the big booking sites do:

     * a rail of the next days, each showing how many free times it has;
     * a grid of times for the chosen day (morning / afternoon / evening);
     * a summary card that always shows who, when and where;
     * a short reason plus "routine / urgent / follow-up", which is how a clinic
       decides who goes first;
     * for the front desk: a person who has never been to the clinic can be
       written into the register without leaving the page (a walk-in).

   The desk is drawn either inside a page or inside a window - the same markup
   and the same code do both, so the two can never drift apart.

   Every rule (is the slot free? is the patient active? may this role book?)
   stays on the server; this module only asks for the free times and sends the
   choice back.
   ========================================================================== */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

import { openJoinWaitlist, waitingListInvite } from './waitlist.js';

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * The markup of the booking desk.
 *
 * @param {object} options { escape, avatar, canRegisterNewPatient, isPatient, seed }
 */
export function bookingDeskHtml(options = {}) {
    const escape = options.escape || escapeHtml;
    const seed = options.seed || {};
    const showWho = !options.isPatient;
    return `
        <div class="book-grid">
            <div>
                <div class="book-steps">
                    <div class="book-step is-on" data-step="1"><span class="n">1</span> Doctor</div>
                    <div class="book-step" data-step="2"><span class="n">2</span> Day and time</div>
                    <div class="book-step" data-step="3"><span class="n">3</span> Details</div>
                </div>

                <div class="field">
                    <label for="bkDoctor">Which doctor would you like to see?</label>
                    <select id="bkDoctor" data-bk="doctor"><option value="">Loading the medical team…</option></select>
                    <div class="hint" data-bk="doctor-hint"></div>
                </div>

                ${options.isPatient ? `<div class="field"><label>Who is the appointment for?</label>
                    <div class="book-who" data-bk="who-self">
                        <span class="avatar sm" data-bk="who-avatar"></span>
                        <div><strong data-bk="who-name">You</strong>
                            <span class="cell-sub">This visit is booked in your own name.</span></div>
                    </div>
                </div>` : ''}
                <div class="field${showWho ? '' : ' pp-hidden'}" data-bk="who-field">
                    <label for="bkPatient">Who is the appointment for?</label>
                    <select id="bkPatient" data-bk="patient"><option value="">Loading patients…</option></select>
                    ${options.canRegisterNewPatient ? `<label class="switch" style="margin-top:8px; font-size:12.5px">
                        <input type="checkbox" data-bk="new-toggle"> <span>A new patient — open a record now</span>
                    </label>` : ''}
                </div>

                <div data-bk="new-fields" class="pp-hidden"
                     style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:14px; margin-bottom:14px">
                    <div class="grid cols-2">
                        <div class="field"><label for="bkNewName">Full name</label>
                            <input id="bkNewName" data-bk="new-name" placeholder="e.g. Sanjaya Bandara"></div>
                        <div class="field"><label for="bkNewPhone">Telephone number</label>
                            <input id="bkNewPhone" data-bk="new-phone" placeholder="077 123 4567"></div>
                        <div class="field"><label for="bkNewGender">Gender</label>
                            <select id="bkNewGender" data-bk="new-gender">
                                <option value="">Prefer not to say</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select></div>
                        <div class="field"><label for="bkNewCity">Town</label>
                            <input id="bkNewCity" data-bk="new-city" placeholder="e.g. Ratnapura"></div>
                    </div>
                    <p class="pp-note" style="margin:0">A record is opened with a starter password; the rest of the
                        details can be completed later from the patient's profile.</p>
                </div>

                <div class="pp-head" style="margin-top:6px">
                    <h4>Choose a day</h4>
                    <span class="pp-note" data-bk="day-note">The next three weeks of consulting hours</span>
                </div>
                <div class="day-rail" data-bk="days"></div>

                <div class="pp-head">
                    <h4>Free times</h4>
                    <span class="pp-note" data-bk="slot-note">Select a doctor to see the free times</span>
                </div>
                <div class="slot-grid" data-bk="slots">
                    <div class="book-empty">No doctor chosen yet.</div>
                </div>

                <div class="field" style="margin-top:18px">
                    <label for="bkReason">Reason for the visit</label>
                    <input id="bkReason" data-bk="reason" placeholder="e.g. Fever and cough for three days"
                           value="${escape(seed.reason || '')}">
                </div>
                <div class="grid cols-2">
                    <div class="field"><label for="bkPriority">How soon?</label>
                        <select id="bkPriority" data-bk="priority">
                            <option value="NORMAL">Routine visit</option>
                            <option value="URGENT">Urgent — should be seen soon</option>
                            <option value="FOLLOW_UP">Follow-up of an earlier visit</option>
                        </select></div>
                    <div class="field"><label for="bkPhone">A telephone number we can reach you on</label>
                        <input id="bkPhone" data-bk="phone" placeholder="077 123 4567"></div>
                </div>

                <div class="reassure">
                    <i data-lucide="shield-check" class="ico-18"></i>
                    <span>A confirmation appears in your notifications, the visit shows up under
                        <strong>Appointments</strong> straight away, and a check-in pass is created with it.</span>
                </div>
            </div>

            <aside class="book-side">
                <div class="book-card" data-bk="summary"></div>
                <div class="book-card">
                    <h4><i data-lucide="info" class="ico-18"></i> Good to know</h4>
                    <ul class="feature-list" style="font-size:13px; margin:0">
                        <li>Please arrive about ten minutes before the appointment.</li>
                        <li>Cancelling is free — the time goes back to the clinic for another patient.</li>
                        <li>Urgent visits are placed ahead of routine visits wherever the clinic can.</li>
                    </ul>
                </div>
            </aside>
        </div>

        <div class="form-actions" style="margin-top:18px">
            <button class="btn btn-primary" data-bk="submit" type="button" disabled>
                <i data-lucide="calendar-check" class="ico-16"></i> Confirm the appointment
            </button>
            ${options.modal ? '<button class="btn btn-ghost" data-act="cancel" type="button">Close</button>' : ''}
        </div>`;
}

/**
 * Makes the desk work: loads the doctors and the free times, paints the day
 * rail and the time grid, keeps the summary up to date and books the visit.
 *
 * @param {object} deps { api, toast, drawIcons, escape, avatar, me, refresh, onClose }
 * @param {Element} root the element holding the markup above
 * @param {object} seed  { doctorId, patientId, slotId, reason }
 */
export function bindBookingDesk(deps, root, seed = {}) {
    const { api, toast, drawIcons, me, avatar, modal, go, fail } = deps;
    const enhanceSelect = deps.enhanceSelect || null;
    const escape = deps.escape || escapeHtml;
    const state = { doctors: [], doctor: null, patients: [], days: [], day: null, slot: null };
    const canRegisterNewPatient = !!me && (me.role === 'ADMIN' || me.role === 'RECEPTIONIST');
    const isPatient = !!me && me.role === 'PATIENT';

    const initialsOf = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2)
        .map(part => part[0] || '').join('').toUpperCase();

    const $ = (selector) => root.querySelector(selector);
    const doctorSelect = $('[data-bk="doctor"]');
    const patientSelect = $('[data-bk="patient"]');
    const daysBox = $('[data-bk="days"]');
    const slotsBox = $('[data-bk="slots"]');
    const slotNote = $('[data-bk="slot-note"]');
    const summary = $('[data-bk="summary"]');
    const submit = $('[data-bk="submit"]');
    const newToggle = $('[data-bk="new-toggle"]');

    const selfBox = $('[data-bk="who-avatar"]');
    if (isPatient && selfBox && typeof avatar === 'function') {
        selfBox.innerHTML = avatar(me.photo, me.fullName, 34);
        const nameBox = $('[data-bk="who-name"]');
        if (nameBox) nameBox.textContent = me.fullName;
    }

    if (isPatient && me.phone) {
        const phoneField = $('[data-bk="phone"]');
        if (phoneField && !phoneField.value) {
            phoneField.value = me.phone;
        }
    }

    const refreshSubmit = () => {
        submit.disabled = !(state.doctor && state.slot && whoReady());
    };

    function whoReady() {
        if (isPatient) {
            return true;
        }
        if (newToggle && newToggle.checked) {
            const name = $('[data-bk="new-name"]');
            return !!(name && name.value.trim());
        }
        return !!(patientSelect && patientSelect.value);
    }

    /* --------------------------------------------------------- load people */
    const doctorsPromise = api('/doctors?activeOnly=true');
    const patientsPromise = canRegisterNewPatient
        ? api('/patients/options').catch(() => ({ patients: [] }))
        : Promise.resolve({ patients: [] });

    Promise.all([doctorsPromise, patientsPromise]).then(([doctorData, patientData]) => {
        state.doctors = doctorData.doctors || [];
        state.patients = patientData.patients || [];
        doctorSelect.innerHTML = '<option value="">Choose a doctor…</option>' + state.doctors.map(d =>
            `<option value="${d.id}"${String(seed.doctorId) === String(d.id) ? ' selected' : ''}>` +
            `Dr. ${escape(d.fullName)} — ${escape(d.specialization || '')}</option>`).join('');
        if (patientSelect) {
            if (isPatient) {
                patientSelect.innerHTML = `<option value="${me.id}" selected>${escape(me.fullName)} (you)</option>`;
            } else {
                patientSelect.innerHTML = '<option value="">Choose a patient…</option>' + state.patients.map(p =>
                    `<option value="${p.id}"${String(seed.patientId) === String(p.id) ? ' selected' : ''}>` +
                    `${escape(p.fullName)}${p.phone ? ' · ' + escape(p.phone) : ''}</option>`).join('');
            }
        }
        /* the two long lists become searchable the moment they are filled */
        if (typeof enhanceSelect === 'function') {
            enhanceSelect(doctorSelect, {
                placeholder: 'Choose a doctor…',
                searchPlaceholder: 'Type a name or a speciality…',
                render: (item) => {
                    const doctor = state.doctors.find(d => String(d.id) === String(item.value));
                    if (!doctor) return { title: item.text };
                    return {
                        title: 'Dr. ' + doctor.fullName,
                        meta: [doctor.specialization, doctor.roomNo ? roomLabel(doctor.roomNo) : null,
                            doctor.consultationMinutes ? doctor.consultationMinutes + ' min visit' : null]
                            .filter(Boolean).join(' · '),
                        photo: doctor.photo || null,
                        initials: initialsOf(doctor.fullName)
                    };
                },
                onPick: () => loadFreeTimes()
            });
            if (patientSelect && !isPatient) {
                enhanceSelect(patientSelect, {
                    placeholder: 'Choose a patient…',
                    searchPlaceholder: 'Type a name or a telephone number…',
                    render: (item) => {
                        const person = state.patients.find(p => String(p.id) === String(item.value));
                        if (!person) return { title: item.text };
                        return {
                            title: person.fullName,
                            meta: [person.phone, person.city].filter(Boolean).join(' · ') || 'Registered patient',
                            photo: person.photo || null,
                            initials: initialsOf(person.fullName)
                        };
                    },
                    onPick: () => refreshSubmit()
                });
            }
        }
        if (seed.doctorId) {
            state.doctor = state.doctors.find(d => String(d.id) === String(seed.doctorId)) || null;
            loadFreeTimes(true);
        } else if (seed.patientId) {
            markStep(2);
        }
        paintSummary();
        drawIcons(root);
    }).catch((error) => {
        toast(error.message || 'The booking desk could not be opened', 'error');
    });

    /* ------------------------------------------------------- free times */
    function loadFreeTimes(withSeed) {
        if (!state.doctor) {
            daysBox.innerHTML = '';
            slotsBox.innerHTML = '<div class="book-empty">Choose a doctor first.</div>';
            return;
        }
        daysBox.innerHTML = '<div class="book-empty">Looking for free times…</div>';
        const fromIso = new Date().toISOString().slice(0, 10);
        api(`/appointments/slots?doctorId=${state.doctor.id}&from=${fromIso}`).then((data) => {
            state.days = buildDays(data.slots || []);
            state.day = state.days[0] || null;
            if (withSeed && seed.slotId) {
                const wanted = state.days.find(day => day.slots.some(s => String(s.id) === String(seed.slotId)));
                if (wanted) {
                    state.day = wanted;
                    state.slot = wanted.slots.find(s => String(s.id) === String(seed.slotId)) || null;
                    markStep(3);
                }
            }
            paintDays();
            paintSlots();
            paintSummary();
        }).catch((error) => {
            daysBox.innerHTML = '';
            slotsBox.innerHTML = `<div class="book-empty">${escape(error.message || 'Free times could not be loaded')}</div>`;
        });
    }

    function buildDays(slots) {
        const byDay = new Map();
        slots.forEach((slot) => {
            if (!byDay.has(slot.date)) {
                byDay.set(slot.date, []);
            }
            byDay.get(slot.date).push(slot);
        });
        return [...byDay.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(0, 14)
            .map(([date, daySlots]) => ({
                date,
                slots: daySlots.slice().sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
            }));
    }

    /** The invitation to the waiting list, when a doctor has no free time. */
    function wireWaitInvite() {
        const button = daysBox.querySelector('[data-bk="wait-join"]');
        if (!button || !state.doctor) {
            return;
        }
        button.addEventListener('click', () => {
            if (typeof deps.openJoinWaitlist === 'function' || typeof openJoinWaitlist === 'function') {
                (deps.openJoinWaitlist || openJoinWaitlist)({
                    doctor: state.doctor, api, toast, modal, drawIcons, escape, me: deps.me,
                    fail, onDone: () => {
                        if (typeof deps.refresh === 'function') {
                            deps.refresh(null);
                        }
                    }
                });
            }
        });
    }

    function paintDays() {
        if (!state.days.length) {
            daysBox.innerHTML = state.doctor
                ? '<div class="book-empty">No free time in the next three weeks — please choose another doctor.</div>'
                    + waitingListInvite(state.doctor, { escape, drawIcons })
                : '<div class="book-empty">No free times in the next three weeks — please choose another doctor.</div>';
            wireWaitInvite();
            return;
        }
        daysBox.innerHTML = state.days.map((day) => {
            const date = new Date(day.date + 'T00:00:00');
            const on = state.day && state.day.date === day.date;
            return `<button class="day-chip${on ? ' is-on' : ''}" type="button" data-day="${day.date}">
                <span class="dow">${DAY_LABELS[date.getDay()]}</span>
                <span class="dom">${date.getDate()}</span>
                <span class="free">${day.slots.length} free</span>
            </button>`;
        }).join('');
        daysBox.querySelectorAll('[data-day]').forEach(button => button.addEventListener('click', () => {
            state.day = state.days.find(day => day.date === button.dataset.day) || null;
            state.slot = null;
            paintDays();
            paintSlots();
            paintSummary();
        }));
    }

    function periodOf(time) {
        const hour = Number(String(time).slice(0, 2));
        if (hour < 12) {
            return 'morning';
        }
        return hour < 17 ? 'afternoon' : 'evening';
    }

    function paintSlots() {
        if (!state.day) {
            slotsBox.innerHTML = '<div class="book-empty">Choose a day above to see its free times.</div>';
            slotNote.textContent = '';
            return;
        }
        const pretty = new Date(state.day.date + 'T00:00:00')
            .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        slotNote.textContent = `${pretty} · ${state.day.slots.length} free`;
        slotsBox.innerHTML = state.day.slots.map((slot) => {
            const chosen = state.slot && String(state.slot.id) === String(slot.id);
            return `<button class="slot-btn${chosen ? ' is-chosen' : ''}" type="button" data-slot="${slot.id}">
                <span>${escape(slot.startTime)}</span><span class="sl-sub">${periodOf(slot.startTime)}</span>
            </button>`;
        }).join('');
        slotsBox.querySelectorAll('[data-slot]').forEach(button => button.addEventListener('click', () => {
            state.slot = state.day.slots.find(slot => String(slot.id) === button.dataset.slot) || null;
            paintSlots();
            paintSummary();
            refreshSubmit();
            if (state.slot) {
                markStep(3);
            }
        }));
    }

    function paintSummary() {
        const doctor = state.doctor;
        const slot = state.slot;
        const pretty = slot ? new Date(slot.date + 'T00:00:00')
            .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : null;
        summary.innerHTML = `
            <h4><i data-lucide="clipboard-check" class="ico-18"></i> Your appointment</h4>
            ${doctor ? `<div class="book-doctor" style="margin-bottom:12px">
                    <div class="bd-face">${avatar ? avatar(doctor.photo, doctor.fullName, 0, { fill: true }) : ''}</div>
                    <div>
                        <strong>Dr. ${escape(doctor.fullName)}</strong>
                        <div class="bd-meta">${escape(doctor.specialization || '')}${doctor.roomNo ? ' · ' + escape(roomLabel(doctor.roomNo)) : ''}</div>
                    </div>
                </div>` : '<p class="book-empty">No doctor chosen yet.</p>'}
            <div class="book-lines">
                <div class="bl-row"><span>Day</span><strong>${pretty ? escape(pretty) : 'not chosen'}</strong></div>
                <div class="bl-row"><span>Time</span><strong>${slot ? escape(slot.startTime) + ' – ' + escape(slot.endTime) : 'not chosen'}</strong></div>
                <div class="bl-row"><span>Clinic</span><strong>MedCare Clinic, Ratnapura</strong></div>
                <div class="bl-row bl-total"><span>Consultation fee</span>
                    <strong>${doctor && doctor.consultationFee ? 'Rs ' + Math.round(doctor.consultationFee) : 'at the desk'}</strong></div>
            </div>`;
        drawIcons(summary);
        refreshSubmit();
    }

    function markStep(number) {
        root.querySelectorAll('.book-step').forEach((node) => {
            const own = Number(node.dataset.step);
            node.classList.toggle('is-on', own === number);
            node.classList.toggle('is-done', own < number);
        });
    }

    /* ------------------------------------------------------------ events */
    doctorSelect.addEventListener('change', () => {
        state.doctor = state.doctors.find(d => String(d.id) === doctorSelect.value) || null;
        state.slot = null;
        markStep(2);
        const hint = $('[data-bk="doctor-hint"]');
        if (hint) {
            hint.textContent = state.doctor
                ? `${state.doctor.specialization || 'Consultant'}${state.doctor.consultationMinutes ? ' · ' + state.doctor.consultationMinutes + ' minute consultation' : ''}`
                : '';
        }
        loadFreeTimes(false);
    });

    if (newToggle) {
        newToggle.addEventListener('change', () => {
            $('[data-bk="new-fields"]').classList.toggle('pp-hidden', !newToggle.checked);
            if (patientSelect) {
                patientSelect.closest('.field').classList.toggle('pp-hidden', newToggle.checked);
            }
            refreshSubmit();
        });
    }
    ['reason', 'priority', 'phone', 'new-name', 'new-phone', 'new-city', 'new-gender'].forEach((key) => {
        const field = root.querySelector(`[data-bk="${key}"]`);
        if (field) {
            field.addEventListener('input', refreshSubmit);
            field.addEventListener('change', refreshSubmit);
        }
    });
    if (patientSelect) {
        patientSelect.addEventListener('change', refreshSubmit);
    }

    submit.addEventListener('click', async () => {
        if (!state.doctor || !state.slot) {
            toast('Please choose a doctor and a free time', 'error');
            return;
        }
        const payload = {
            doctorId: state.doctor.id,
            slotId: state.slot.id,
            reason: ($('[data-bk="reason"]') || {}).value || null,
            priority: ($('[data-bk="priority"]') || {}).value || 'NORMAL'
        };
        if (newToggle && newToggle.checked) {
            payload.newPatientName = $('[data-bk="new-name"]').value.trim();
            payload.newPatientPhone = ($('[data-bk="new-phone"]') || {}).value || null;
            payload.newPatientGender = ($('[data-bk="new-gender"]') || {}).value || null;
            payload.newPatientCity = ($('[data-bk="new-city"]') || {}).value || null;
        } else if (isPatient) {
            /* A signed-in patient books for themselves; the clinic's own rule
               checks this again on the server. */
            payload.patientId = me.id;
        } else if (patientSelect) {
            payload.patientId = patientSelect.value ? Number(patientSelect.value) : null;
        }
        submit.disabled = true;
        const original = submit.innerHTML;
        submit.innerHTML = 'Booking…';
        try {
            const data = await api('/appointments', { method: 'POST', body: payload });
            const appointment = data.appointment || {};
            toast(`${data.message || 'Appointment booked'} · ${appointment.referenceNo || ''}`);
            if (deps.onClose) {
                deps.onClose(appointment);
            }
            if (deps.refresh) {
                deps.refresh(appointment);
            }
        } catch (error) {
            toast(error.message || 'The appointment could not be booked', 'error');
            submit.innerHTML = original;
            submit.disabled = false;
        }
    });
}

/** The same desk inside a window - used when booking from a doctor's card. */
export function openBookingDesk(deps, seed = {}) {
    const escape = deps.escape || escapeHtml;
    const isPatient = !!deps.me && deps.me.role === 'PATIENT';
    const canRegisterNewPatient = !!deps.me && (deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST');
    const window_ = deps.modal({
        title: 'Book an appointment',
        subtitle: 'Three quick steps: choose your doctor, pick a free time, confirm.',
        body: bookingDeskHtml({ escape, avatar: deps.avatar, isPatient, canRegisterNewPatient, seed, modal: true }),
        footer: '',
        wide: true,
        onMount: (root) => {
            const cancel = root.querySelector('[data-act="cancel"]');
            if (cancel) {
                cancel.addEventListener('click', () => window_.close());
            }
            bindBookingDesk({ ...deps, onClose: () => window_.close() }, root, seed);
            deps.drawIcons(root);
        }
    });
    return window_;
}
