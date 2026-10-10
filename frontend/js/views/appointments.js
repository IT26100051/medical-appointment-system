import { roomLabel } from '../modules/labels.js';
/* =============================================================================
   MedCare - Appointment pages
   =============================================================================
   Component 03 - Appointment Management: booking, the role based list,
   cancellation, rescheduling, completion and the appointment window.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function appointmentsView(deps) {
    const { EASE, MedCare, QRCode, anim, api, avatarHtml, confirmDialog, dash, drawIcons, esc, fail, fmtDate, fmtDateTime, fmtTime, go, lucide, modal, personCell, priorityPill, promptDialog, readForm, relativeChip, statusBadge, tableBlock, toast, tokenChip, visit, $, $$ , searchBox, bindSearch, enhanceSelect} = deps;
    const links = deps.links || {};
    const { openFeedbackModal } = links;

/* =====================================================================
   APPOINTMENTS - BOOKING DESK
   ================================================================== */
/**
 * The booking desk (Component 03).  The layout and the behaviour come from
 * js/modules/booking.js, so the booking page and the "book from a doctor
 * card" window are always the same thing; if that module is ever missing,
 * the classic form below takes over and booking still works.
 */
async function renderAppointmentForm(container, params = {}) {
    if (!MedCare || typeof MedCare.bookingDeskHtml !== 'function') {
        return renderSimpleAppointmentForm(container, params);
    }
    const seed = {
        doctorId: params.doctorId || null,
        patientId: params.patientId || (deps.me.role === 'PATIENT' ? deps.me.id : null),
        slotId: params.slotId || null,
        reason: params.reason || ''
    };
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>Book an appointment</h3>
                <span class="sub">Every free time below comes straight from the clinic's consulting hours</span>
            </div>
            <div class="card-pad">${MedCare.bookingDeskHtml({
                escape: esc,
                avatar: avatarHtml,
                isPatient: deps.me.role === 'PATIENT',
                canRegisterNewPatient: deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST',
                seed
            })}</div>
        </div>`;
    drawIcons(container);
    MedCare.bindBookingDesk({
        api, toast, drawIcons, escape: esc, avatar: avatarHtml, me: deps.me, enhanceSelect,
        modal, go, fail, searchBox, bindSearch,
        openJoinWaitlist: (window.MedCare.waitlist || {}).openJoinWaitlist || null,
        refresh: (appointment) => {
            go('appointments');
        }
    }, container, seed);
}

/** Used only if the bundle is unavailable: the original simple booking form. */
async function renderSimpleAppointmentForm(container, params = {}) {
    const isPatient = deps.me.role === 'PATIENT';
    const doctorList = await api('/doctors?activeOnly=true');
    const patientList = isPatient ? { patients: [] } : await api('/patients/options');
    container.innerHTML = `
        <div class="card">
            <div class="card-head"><h3>Book an appointment</h3>
                <span class="sub">Three quick steps: choose your doctor, pick a time, confirm</span></div>
            <form id="bookingForm" class="card-pad">
                <div class="form-row">
                    ${isPatient ? `
                        <div class="field"><label>Patient</label>
                            <input value="${esc(deps.me.fullName)} (you)" disabled>
                            <div class="hint">Patients book for themselves; the front desk books for any patient.</div></div>`
                    : `<div class="field"><label>Patient <span class="req">*</span></label>
                        <select name="patientId" id="patientSelect" required>
                            <option value="">Select a patient...</option>
                            ${patientList.patients.map(p => `<option value="${p.id}">${esc(p.fullName)} — ${esc(p.phone || 'no phone')}</option>`).join('')}
                        </select></div>`}
                    <div class="field">
                        <label>Doctor <span class="req">*</span></label>
                        <div class="doctor-picker" id="doctorPicker">
                            ${doctorList.doctors.map(d => `
                                <button type="button" class="doctor-choice" data-doctor="${d.id}">
                                    ${avatarHtml(d.photo, d.fullName, 54)}
                                    <span class="dc-name">Dr. ${esc(d.fullName)}</span>
                                    <span class="dc-spec">${esc(d.specialization || '')}</span>
                                    <span class="dc-meta">${d.consultationMinutes} min${d.consultationFee ? ' · Rs ' + esc(String(Math.round(d.consultationFee))) : ''}</span>
                                </button>`).join('')}
                        </div>
                        <input type="hidden" name="doctorId" id="doctorSelect" required>
                    </div>
                </div>
                <div class="field">
                    <label>Reason for the visit</label>
                    <input name="reason" placeholder="e.g. Follow-up consultation, chest tightness...">
                </div>
                <div class="field">
                    <label>Available slots <span class="req">*</span></label>
                    <div id="slotArea" class="card card-pad" style="background:var(--surface-2)">
                        <div class="muted small">Choose a doctor to see the available slots.</div>
                    </div>
                    <input type="hidden" name="slotId" id="slotId">
                </div>
                <div class="form-actions">
                    <button type="reset" class="btn">Clear</button>
                    <button type="submit" class="btn btn-primary">${lucide('calendar-plus', 'ico-16')} Book appointment</button>
                </div>
            </form>
        </div>`;

    const loadSlots = async doctorId => {
        const area = $('#slotArea', container);
        if (!doctorId) {
            area.innerHTML = '<div class="muted small">Choose a doctor to see the available slots.</div>';
            return;
        }
        area.innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Checking availability...</span></div>';
        const data = await api(`/appointments/slots?doctorId=${doctorId}`);
        if (!data.slots.length) {
            area.innerHTML = `<div class="empty"><span class="big">${lucide('calendar-x', 'ico-32')}</span>No open times for this doctor yet.
                <div class="small mt-8">Please choose another doctor or call the clinic reception.</div></div>`;
            return;
        }
        const byDate = {};
        data.slots.forEach(slot => (byDate[slot.date] = byDate[slot.date] || []).push(slot));
        area.innerHTML = Object.entries(byDate).map(([date, slots]) => `
            <div style="margin-bottom:14px">
                <div class="small" style="font-weight:700; margin-bottom:8px">${fmtDate(date)}</div>
                <div class="slot-grid">${slots.map(s => `
                    <div class="slot" data-slot="${s.id}">
                        <div class="t">${fmtTime(s.startTime)}</div>
                        <div class="d">until ${fmtTime(s.endTime)}</div>
                    </div>`).join('')}</div>
            </div>`).join('');
        $$('.slot', area).forEach(slot => slot.onclick = () => {
            $$('.slot', area).forEach(s => s.classList.remove('selected'));
            slot.classList.add('selected');
            $('#slotId', container).value = slot.dataset.slot;
        });
    };

    const chooseDoctor = doctorId => {
        $('#doctorSelect', container).value = doctorId;
        $('#slotId', container).value = '';
        $$('.doctor-choice', container).forEach(choice =>
            choice.classList.toggle('selected', String(choice.dataset.doctor) === String(doctorId)));
        loadSlots(doctorId);
    };
    $$('.doctor-choice', container).forEach(choice =>
        choice.onclick = () => chooseDoctor(choice.dataset.doctor));

    $('#bookingForm', container).onsubmit = async event => {
        event.preventDefault();
        const payload = readForm($('#bookingForm', container));
        if (isPatient) payload.patientId = deps.me.id;
        if (!payload.slotId) { toast('Please pick an available slot', 'warn'); return; }
        try {
            const result = await api('/appointments', { method: 'POST', body: payload });
            toast(result.message);
            go('appointments');
        } catch (error) { fail(error); }
    };

    const presetDoctor = params.doctorId
        || (doctorList.doctors.length === 1 ? doctorList.doctors[0].id : null);
    if (presetDoctor) {
        chooseDoctor(presetDoctor);
    }
    if (params.patientId && !isPatient) {
        const select = $('#patientSelect', container) || $('[name="patientId"]', container);
        if (select) select.value = params.patientId;
    }
}

/* =====================================================================
   WAITING ROOM - the day's queue, with a token number for every patient
   The board itself (markup and buttons) lives in js/modules/queue.js;
   this function only fetches, hands the data over and places the board.
   ================================================================== */

async function renderAppointments(container) {
    const isPatient = deps.me.role === 'PATIENT';
    const isDoctor = deps.me.role === 'DOCTOR';
    const canManage = deps.me.role !== 'PATIENT';   // admin, receptionist and doctors manage appointments
    const doctorList = (isPatient || isDoctor) ? { doctors: [] } : await api('/doctors');
    const patientList = isPatient ? { patients: [] } : await api('/patients/options');

    container.innerHTML = `
        <div class="card">
            <div class="card-head appointment-head">
                <h3>${isPatient ? 'My appointments' : isDoctor ? 'My appointments' : 'All appointments'}</h3>
                <span class="sub" id="count"></span>
                <div class="right appointment-controls">
                    ${searchBox({ id: 'search', placeholder: 'Search reference, patient, doctor', label: 'Search appointments', size: 'lg' })}
                    <select id="whenFilter" style="width:150px" title="Which appointments to show">
                        <option value="upcoming">Coming up</option>
                        <option value="today">Today</option>
                        <option value="past">Earlier visits</option>
                        <option value="">Everything</option>
                    </select>
                    <select id="statusFilter" style="width:160px">
                        <option value="">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled (history)</option>
                        <option value="NO_SHOW">No show</option>
                    </select>
                    ${isPatient ? '' : `
                    <select id="doctorFilter" style="width:180px"><option value="">All doctors</option>
                        ${doctorList.doctors.map(d => `<option value="${d.id}">Dr. ${esc(d.fullName)}</option>`).join('')}</select>
                    <select id="patientFilter" style="width:180px"><option value="">All patients</option>
                        ${patientList.patients.map(p => `<option value="${p.id}">${esc(p.fullName)}</option>`).join('')}</select>`}
                    ${isPatient ? '<button class="btn btn-primary btn-sm" id="bookNow">' + lucide('calendar-plus', 'ico-16') + ' Book appointment</button>' : ''}
                </div>
            </div>
            <div id="appointmentTable"></div>
        </div>`;

    let debounce = null;
    const load = async () => {
        const query = new URLSearchParams();
        const q = $('#search').value.trim();
        if (q) query.set('q', q);
        if ($('#statusFilter').value) query.set('status', $('#statusFilter').value);
        const doctorFilter = $('#doctorFilter');
        const patientFilter = $('#patientFilter');
        if (doctorFilter && doctorFilter.value) query.set('doctorId', doctorFilter.value);
        if (patientFilter && patientFilter.value) query.set('patientId', patientFilter.value);
        $('#appointmentTable').innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Loading appointments...</span></div>';
        const data = await api('/appointments?' + query.toString());
        $('#count').textContent = `${data.count} appointment(s)`;
        const when = $('#whenFilter') ? $('#whenFilter').value : '';
        const today = new Date().toISOString().slice(0, 10);
        const rows = (data.appointments || []).filter((a) => {
            if (when === 'today') { return a.date === today; }
            if (when === 'upcoming') { return a.date >= today && (a.status === 'PENDING' || a.status === 'CONFIRMED'); }
            if (when === 'past') { return a.date < today || a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'NO_SHOW'; }
            return true;
        });
        $('#count').textContent = `${rows.length} shown${rows.length !== data.count ? ' of ' + data.count : ''}`;
        $('#appointmentTable').innerHTML = tableBlock([
            { label: isPatient ? 'Reference' : 'Patient', cell: a => (isPatient
                    ? `<span class="mono">${esc(a.referenceNo)}</span><span class="cell-sub">${fmtDate(a.date)}</span>`
                    : personCell(a.patientPhoto, a.patientName, a.patientPhone || fmtDate(a.date))) },
            { label: isPatient ? 'Doctor' : 'Reference', cell: a => (isPatient
                    ? `<span class="cell-strong">${esc(a.doctorName)}</span><span class="cell-sub">${esc(a.specialization || '')}</span>`
                    : `<span class="mono">${esc(a.referenceNo)}</span> ${priorityPill(a.priorityLabel, a.priority)}`) },
            { label: 'When', cell: a => `${fmtDate(a.date)} ${relativeChip(a.date, a.upcoming)}
                    <span class="cell-sub">${fmtTime(a.startTime)} – ${fmtTime(a.endTime)}</span>
                    ${tokenChip(a, 'sm')}` },
            { label: 'Reason', cell: a => `<span class="small">${dash(a.reason)}</span>` },
            { label: 'Status', cell: a => statusBadge(a.status, a.statusLabel) +
                    (a.status === 'CANCELLED' && a.cancellationReason ? `<span class="cell-sub">${esc(a.cancellationReason)}</span>` : '') },
            { label: '', right: true, cell: a => `<div class="row-actions">
                    ${canManage && a.status === 'PENDING' ? `<button class="btn btn-sm btn-primary" data-confirm="${a.id}" title="Confirm this appointment">${lucide('check', 'ico-16')} Confirm</button>` : ''}
                    ${canManage && (a.status === 'CONFIRMED' || a.status === 'PENDING') ? `<button class="btn btn-sm" data-complete="${a.id}" title="Finish the consultation">${lucide('check-check', 'ico-16')} Complete</button>` : ''}
                    ${isPatient && (a.status === 'PENDING' || a.status === 'CONFIRMED') && a.upcoming
                        ? `<button class="btn btn-sm btn-danger" data-cancel="${a.id}" title="Cancel this appointment">${lucide('calendar-x', 'ico-16')} Cancel</button>` : ''}
                    ${isPatient && a.status === 'COMPLETED' && a.canFeedback ? `<button class="btn btn-sm" data-feedback="${a.id}" title="Rate this consultation">${lucide('star', 'ico-16')} Feedback</button>` : ''}
                    <button class="btn btn-sm" data-open="${a.id}">Manage</button></div>` }
        ], rows, 'No appointments match the current filters');

        $$('[data-open]', container).forEach(b => b.onclick = () => openAppointmentDetail(b.dataset.open, load));

        /* quick actions straight from the list */
        $$('[data-confirm]', container).forEach(b => b.onclick = async () => {
            try { const r = await api(`/appointments/${b.dataset.confirm}/confirm`, { method: 'POST' }); toast(r.message); load(); }
            catch (e) { fail(e); }
        });
        $$('[data-complete]', container).forEach(b => b.onclick = () => {
            const appointment = data.appointments.find(item => String(item.id) === b.dataset.complete);
            completeAppointment(b.dataset.complete, () => load(), appointment);
        });
        $$('[data-cancel]', container).forEach(b => b.onclick = () => cancelAppointment(b.dataset.cancel, null, () => load()));
        $$('[data-feedback]', container).forEach(b => b.onclick = () => {
            const appointment = data.appointments.find(a => String(a.id) === b.dataset.feedback);
            openFeedbackModal(appointment, () => load());
        });
    };

    bindSearch(container, { id: 'search', onSearch: () => load() });
    $('#statusFilter').onchange = load;
    if ($('#whenFilter')) $('#whenFilter').onchange = load;
    if ($('#doctorFilter')) $('#doctorFilter').onchange = load;
    if ($('#patientFilter')) $('#patientFilter').onchange = load;
    if ($('#bookNow')) $('#bookNow').onclick = () => go('appointmentNew');
    await load();
}

/**
 * Draws the check-in code inside the frame the pass provides.
 * The code library may answer straight away or with a promise, so both are
 * handled; if it cannot draw one, the frame is simply removed.
 */
function fillPassCode(frame, text) {
    if (!frame) {
        return;
    }
    if (!QRCode || typeof QRCode.toString !== 'function' || !text) {
        frame.remove();
        return;
    }
    const draw = (svg) => {
        if (typeof svg === 'string' && svg.trim()) {
            frame.innerHTML = svg;
            anim(frame, { opacity: [0, 1], scale: [.92, 1] }, { duration: .45, ease: EASE });
        } else {
            frame.remove();
        }
    };
    try {
        const result = QRCode.toString(String(text), { type: 'svg', margin: 1, width: 240 });
        if (typeof result === 'string') {
            draw(result);
        } else {
            Promise.resolve(result).then(draw).catch(() => frame.remove());
        }
    } catch (error) {
        frame.remove();
    }
}

/** Saves the check-in pass as a small file the patient can keep or print. */
function downloadPass(pass) {
    const lines = [
        'MEDCARE CLINIC - CHECK-IN PASS',
        '----------------------------------------',
        'Reference      : ' + (pass.referenceNo || ''),
        'Patient        : ' + (pass.patientName || ''),
        'Doctor         : ' + (pass.doctorName || ''),
        'Where          : ' + (roomLabel(pass.roomNo) || pass.specialization || 'Consulting rooms'),
        'Date           : ' + (pass.date || ''),
        'Time           : ' + (pass.timeLabel || ''),
        'Visit type     : ' + (pass.priorityLabel || 'Routine'),
        'Status         : ' + (pass.statusLabel || ''),
        '',
        pass.arrivalNote || 'Please arrive about ten minutes early.',
        '',
        'MedCare Clinic, 112 Galle Road, Ratnapura - 045 222 3344'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `check-in-${pass.referenceNo || 'pass'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast('The check-in pass has been saved');
}

/** Routine / urgent / follow-up - the clinic can reprioritise a booking. */
function openPriorityDialog(appointment, id, onDone, closeDetail) {
    modal({
        title: 'How soon should this patient be seen?',
        subtitle: appointment.referenceNo,
        body: `<div class="field"><label>Visit type</label>
                <select id="prioPick">
                    <option value="NORMAL">Routine visit</option>
                    <option value="URGENT">Urgent - should be seen soon</option>
                    <option value="FOLLOW_UP">Follow-up of an earlier visit</option>
                </select>
                <div class="hint">Urgent visits are placed ahead of routine visits wherever the clinic can.</div>
            </div>`,
        footer: `<button class="btn btn-ghost" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="ok">Save</button>`,
        onMount: (backdrop, close) => {
            $('#prioPick', backdrop).value = appointment.priority || 'NORMAL';
            $('[data-act="cancel"]', backdrop).onclick = close;
            $('[data-act="ok"]', backdrop).onclick = async () => {
                try {
                    const result = await api(`/appointments/${id}/priority`, {
                        method: 'POST', body: { priority: $('#prioPick', backdrop).value }
                    });
                    toast(result.message);
                    close();
                    if (closeDetail) closeDetail();
                    if (onDone) await onDone();
                } catch (error) { fail(error); }
            };
        }
    });
}

/* Completing (finishing) an appointment - shared by the list and the detail dialog. */
/**
 * Finishing a consultation.  This is the moment a real clinic writes the
 * visit summary the patient reads afterwards, and books the review visit
 * when the doctor asks for one - so both are collected right here.
 */
function completeAppointment(id, onDone, appointment) {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    modal({
        title: 'Complete the consultation',
        subtitle: appointment ? `${appointment.referenceNo} · ${appointment.patientName}` : 'Finish the visit and record the outcome',
        wide: true,
        body: `<form id="completeForm">
                    <div class="field"><label>Visit summary (the patient will see this)</label>
                        <textarea name="visitSummary" rows="4"
                            placeholder="e.g. Upper respiratory infection. Advised rest and fluids; amoxicillin 500mg three times a day for five days."></textarea>
                        <div class="hint">Write it the way you would explain it to the patient - it appears on their record.</div></div>
                    <div class="field"><label>Notes for the clinic (optional)</label>
                        <textarea name="notes" rows="2"
                            placeholder="Anything the next clinician should know"></textarea></div>
                    <div class="grid cols-2">
                        <div class="field"><label>Ask the patient to come back on</label>
                            <input type="date" name="followUpDate" min="${today}" value=""></div>
                        <div class="field"><label>Reason for the follow-up</label>
                            <input name="followUpNotes" placeholder="e.g. Review the blood report"></div>
                    </div>
                    <div class="reassure">
                        <i data-lucide="info" class="ico-18"></i>
                        <span>Leave the follow-up date empty when no review is needed. Completing the visit lets the
                            patient leave feedback and keeps the record in the appointment history.</span>
                    </div>
               </form>`,
        footer: `<button class="btn" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="ok">${lucide('check-check', 'ico-16')} Complete the visit</button>`,
        onMount: (backdrop, close) => {
            $('[data-act="cancel"]', backdrop).onclick = close;
            $('[data-act="ok"]', backdrop).onclick = async () => {
                const form = $('#completeForm', backdrop);
                const body = {
                    visitSummary: form.querySelector('[name=visitSummary]').value.trim(),
                    notes: form.querySelector('[name=notes]').value.trim(),
                    followUpDate: form.querySelector('[name=followUpDate]').value || null,
                    followUpNotes: form.querySelector('[name=followUpNotes]').value.trim()
                };
                try {
                    const r = await api(`/appointments/${id}/complete`, { method: 'POST', body });
                    toast(r.message);
                    close();
                    if (onDone) await onDone();
                } catch (e) { fail(e, form); }
            };
            setTimeout(() => {
                const summary = $('#completeForm [name=visitSummary]', backdrop);
                if (summary) summary.focus();
            }, 120);
        }
    });
}

/* Cancelling an appointment with a mandatory reason. */
function cancelAppointment(id, reference, onDone) {
    promptDialog({
        title: reference ? 'Cancel appointment ' + reference : 'Cancel appointment',
        label: 'Cancellation reason (kept in the appointment history)',
        placeholder: 'e.g. Patient called to postpone, doctor unavailable...',
        confirmLabel: 'Cancel appointment',
        onConfirm: async reason => {
            try {
                const r = await api(`/appointments/${id}/cancel`, { method: 'POST', body: { reason } });
                toast(r.message, 'warn');
                if (onDone) await onDone();
            } catch (e) { fail(e); }
        }
    });
}

async function openAppointmentDetail(id, onDone) {
    const data = await api('/appointments/' + id);
    const a = data.appointment;
    const passData = await api(`/appointments/${id}/pass`).catch(() => ({ pass: null }));
    const pass = passData.pass;
    const history = (await api(`/appointments?patientId=${a.patientId}`).catch(() => ({ appointments: [] }))).appointments
        .filter(item => String(item.id) !== String(a.id));
    const isPatient = deps.me.role === 'PATIENT';
    const isDoctor = deps.me.role === 'DOCTOR';
    const canManage = !isPatient;                       // admin, receptionist, doctor
    const alternatives = (data.alternativeSlots || []).slice(0, 18);
    const open = a.status === 'PENDING' || a.status === 'CONFIRMED';
    const isMine = isPatient;                           // getAuthorised already proved ownership

    modal({
        title: 'Appointment ' + a.referenceNo,
        subtitle: `${fmtDate(a.date)} · ${fmtTime(a.startTime)} - ${fmtTime(a.endTime)} · ${a.statusLabel}`,
        wide: true,
        body: `
            ${pass && visit ? visit.passHtml(pass, { escape: esc }) : ''}
            ${a.token ? `<div class="queue-strip">
                    <span class="token-chip${a.priority === 'URGENT' ? ' is-urgent' : ''}">
                        ${lucide('ticket', 'ico-16')} Token ${a.token}</span>
                    <span class="qs-text">${esc(a.tokenNote || '')}</span>
                </div>` : ''}
            <div style="margin-top:16px">
                ${visit ? visit.summaryHtml(a, { escape: esc }) : ''}
            </div>
            <div class="grid cols-2">
                <div>
                    <dl class="kv">
                        <dt>Reference</dt><dd class="mono">${esc(a.referenceNo)}</dd>
                        <dt>Patient</dt><dd>${esc(a.patientName)}${a.patientPhone ? `<div class="small muted">${esc(a.patientPhone)}</div>` : ''}</dd>
                        <dt>Doctor</dt><dd>${esc(a.doctorName)}<div class="small muted">${esc(a.specialization || '')}</div></dd>
                        <dt>Date & time</dt><dd>${fmtDate(a.date)} · ${fmtTime(a.startTime)} - ${fmtTime(a.endTime)}</dd>
                        <dt>Status</dt><dd>${statusBadge(a.status, a.statusLabel)}</dd>
                        <dt>Visit type</dt><dd>${priorityPill(a.priorityLabel, a.priority)}
                            <div class="small muted">${esc(a.priorityNote || '')}</div></dd>
                        <dt>Place in line</dt><dd>${a.token
                            ? `${tokenChip(a)}<div class="small muted">${esc(a.tokenNote || '')}</div>`
                            : '<span class="muted small">A token is given for open visits</span>'}</dd>
                        <dt>Reason</dt><dd>${dash(a.reason)}</dd>
                        <dt>Clinic notes</dt><dd>${dash(a.notes)}</dd>
                        <dt>Booked by</dt><dd class="small">${dash(a.createdBy)}<div class="muted">${fmtDateTime(a.createdAt)}</div></dd>
                        ${a.status === 'CANCELLED' ? `
                            <dt>Cancellation reason</dt><dd>${dash(a.cancellationReason)}</dd>
                            <dt>Cancelled by</dt><dd>${dash(a.cancelledBy)}</dd>` : ''}
                        <dt>Last updated</dt><dd>${a.updatedAt ? fmtDateTime(a.updatedAt) : 'never'}</dd>
                    </dl>
                </div>
                <div>
                    <div class="section-title" style="margin-top:0"><h2>Earlier visits</h2></div>
                    ${visit ? visit.historyHtml(history, { escape: esc }) : '<p class="small muted">No earlier visits.</p>'}
                    <div class="section-title"><h2>${a.status === 'PENDING' || a.status === 'CONFIRMED' ? 'Reschedule to another time' : 'Other times'}</h2></div>
                    ${alternatives.length === 0
                        ? '<p class="muted small">No other open slots for this doctor.</p>'
                        : `<div class="slot-grid">${alternatives.map(s => `
                            <div class="slot" data-reschedule="${s.id}">
                                <div class="t">${fmtTime(s.startTime)}</div><div class="d">${fmtDate(s.date)}</div></div>`).join('')}</div>
                           <div class="hint small mt-8">Selecting a slot reschedules this appointment immediately.</div>`}
                </div>
            </div>`,
        footer: `
            ${a.status === 'PENDING' && canManage ? '<button class="btn btn-primary" data-act="confirm">' + lucide('check', 'ico-16') + ' Confirm</button>' : ''}
            ${open && canManage ? '<button class="btn btn-primary" data-act="complete">' + lucide('check-check', 'ico-16') + ' Complete</button>' : ''}
            ${a.status === 'CONFIRMED' && canManage ? '<button class="btn" data-act="noshow">' + lucide('user-x', 'ico-16') + ' No show</button>' : ''}
            ${open && canManage ? `<button class="btn" data-act="priority">${lucide('flag', 'ico-16')} Change priority</button>` : ''}
            ${a.status === 'COMPLETED' && canManage ? `<button class="btn" data-act="reopen">${lucide('undo-2', 'ico-16')} Reopen</button>` : ''}
            ${open && (canManage || (isMine && a.upcoming)) ? '<button class="btn btn-danger" data-act="cancel">' + lucide('calendar-x', 'ico-16') + ' Cancel</button>' : ''}
            ${a.status === 'COMPLETED' && isPatient && a.canFeedback ? '<button class="btn btn-primary" data-act="feedback">' + lucide('star', 'ico-16') + ' Give feedback</button>' : ''}
            ${deps.me.role === 'ADMIN' && !open ? '<button class="btn btn-danger" data-act="delete">' + lucide('trash-2', 'ico-16') + ' Delete record</button>' : ''}
            <button class="btn" data-act="close">Close</button>`,
        onMount: (backdrop, close) => {
            const act = (name, handler) => { const node = $(`[data-act="${name}"]`, backdrop); if (node) node.onclick = handler; };
            fillPassCode($('[data-pass-code]', backdrop), a.referenceNo);
            const savePass = $('[data-pass-save]', backdrop);
            if (savePass) {
                savePass.onclick = () => downloadPass(pass || { referenceNo: a.referenceNo });
            }
            const printPass = $('[data-pass-print]', backdrop);
            if (printPass) {
                printPass.onclick = () => window.print();
            }
            act('priority', () => openPriorityDialog(a, id, onDone, close));
            act('close', close);
            act('confirm', async () => { try { const r = await api(`/appointments/${id}/confirm`, { method: 'POST' }); toast(r.message); close(); await onDone(); } catch (e) { fail(e); } });
            act('complete', () => { close(); completeAppointment(id, onDone, a); });
            act('reopen', () => confirmDialog({
                title: 'Reopen this appointment',
                message: 'Reopening puts the appointment back to Confirmed so it can be managed again (useful if it was completed by mistake).',
                confirmLabel: 'Reopen as confirmed',
                danger: false,
                onConfirm: async () => {
                    try {
                        await api(`/appointments/${id}/reopen`, { method: 'POST' });
                        toast('Appointment reopened and set back to Confirmed');
                        close(); if (onDone) await onDone();
                    } catch (e) { fail(e); }
                }
            }));
            act('noshow', async () => { try { const r = await api(`/appointments/${id}/no-show`, { method: 'POST' }); toast(r.message, 'warn'); close(); await onDone(); } catch (e) { fail(e); } });
            act('cancel', () => { close(); cancelAppointment(id, a.referenceNo, onDone); });
            act('feedback', () => { close(); openFeedbackModal({ id, referenceNo: a.referenceNo, doctorName: a.doctorName, date: a.date }, onDone); });
            act('delete', () => confirmDialog({
                title: 'Delete appointment record',
                message: 'Finished appointments are kept as history. Deleting is only for approved test data - this cannot be undone.',
                confirmLabel: 'Delete permanently',
                onConfirm: async () => { try { const r = await api(`/appointments/${id}`, { method: 'DELETE' }); toast(r.message, 'warn'); close(); await onDone(); } catch (e) { fail(e); } }
            }));

            $$('[data-reschedule]', backdrop).forEach(slot => slot.onclick = () => confirmDialog({
                title: 'Reschedule appointment',
                message: `Move ${a.referenceNo} to ${slot.querySelector('.d').textContent} ${slot.querySelector('.t').textContent}?`,
                confirmLabel: 'Reschedule',
                danger: false,
                onConfirm: async () => {
                    try {
                        const r = await api(`/appointments/${id}/reschedule`, { method: 'POST', body: { slotId: slot.dataset.reschedule } });
                        toast(r.message); close(); await onDone();
                    } catch (e) { fail(e); }
                }
            }));
        }
    });
}

    return { renderAppointmentForm, renderSimpleAppointmentForm, renderAppointments, fillPassCode, downloadPass, openPriorityDialog, completeAppointment, cancelAppointment, openAppointmentDetail };
}
