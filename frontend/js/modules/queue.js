import { roomLabel } from './labels.js';
/* =============================================================================
   MedCare - the waiting room (clinic queue)
   -----------------------------------------------------------------------------
   Every person who is booked in for a day has a token number, exactly like the
   slip a hospital desk hands out. The numbers come from the clinic itself
   (GET /api/queue) - this file only draws the board:

     * queueBoardHtml(...)  the board the staff look at
     * bindQueueBoard(...)  its buttons (open a record, mark somebody as seen,
                            say somebody did not arrive, change the day)
     * myPlaceHtml(...)     the small card a patient sees: "you are number 3"

   The module knows nothing about fetching; it is handed the data and a few
   little helpers by the page.
   ========================================================================== */

const esc = (value, fallback) => (value === undefined || value === null || value === '') && fallback !== undefined
    ? fallback
    : String(value === undefined || value === null ? '' : value);

/** "about 45 minutes" - a wait is always spoken in round, human numbers. */
export function waitText(minutes) {
    const value = Number(minutes) || 0;
    if (value <= 0) return 'no waiting';
    if (value < 15) return 'about 10 minutes';
    if (value < 45) return 'about ' + (Math.round(value / 15) * 15) + ' minutes';
    if (value < 90) return 'about an hour';
    return 'about ' + Math.round(value / 30) * 0.5 + ' hours';
}

/** The big number that is being seen right now. */
function nowServingHtml(summary, escape, hourglass) {
    if (!summary || summary.nowServing === null || summary.nowServing === undefined) {
        return `<div class="queue-now is-idle">
                    <div class="qn-label">Consulting room</div>
                    <div class="qn-number">-</div>
                    <div class="qn-name">Nobody is waiting right now</div>
                </div>`;
    }
    return `<div class="queue-now">
                <div class="qn-label">Now serving${hourglass || ''}</div>
                <div class="qn-number">${escape(String(summary.nowServing))}</div>
                <div class="qn-name">${escape(summary.nowServingName || '')}</div>
            </div>`;
}

/**
 * The whole waiting room.
 *
 * @param data      the answer of the clinic (date, waiting, seen, closed, summary)
 * @param helpers   {escape, avatar, personCell, statusBadge, priorityPill, hourglass}
 * @param options   {canManage, doctors, doctorId, date}
 */
export function queueBoardHtml(data, helpers = {}, options = {}) {
    const escape = helpers.escape || esc;
    const avatar = helpers.avatar || (() => '');
    const personCell = helpers.personCell || ((photo, name, sub) =>
        `<div class="person"><div class="avatar sm">${avatar(photo, name, 34)}</div><div><strong>${escape(name)}</strong>${sub ? `<span class="cell-sub">${escape(sub)}</span>` : ''}</div></div>`);
    const statusBadge = helpers.statusBadge || ((label) => `<span class="badge">${escape(label)}</span>`);
    const priorityPill = helpers.priorityPill || (() => '');
    const waiting = (data && data.waiting) || [];
    const seen = (data && data.seen) || [];
    const closed = (data && data.closed) || [];
    const summary = (data && data.summary) || {};
    const canManage = options.canManage !== false;

    const rows = waiting.map(person => {
        const sub = [person.specialization, roomLabel(person.roomNo)].filter(Boolean).join(' · ');
        return `<tr class="${person.late ? 'is-late' : ''}">
            <td><span class="token-chip${person.priority === 'URGENT' ? ' is-urgent' : ''}">${escape(String(person.token))}</span></td>
            <td>${personCell(person.patientPhoto, person.patientName, person.referenceNo)}</td>
            <td>${escape(person.doctorName)}<span class="cell-sub">${escape(sub)}</span></td>
            <td>${escape(person.timeLabel)}${person.late ? '<span class="cell-sub late-note">Waiting past the booked time</span>' : ''}</td>
            <td>${statusBadge(person.status, person.statusLabel)} ${priorityPill(person.priorityLabel, person.priority)}</td>
            <td class="right">${canManage ? `
                <button class="btn btn-sm" data-open="${person.appointmentId}">Open</button>
                <button class="btn btn-sm btn-primary" data-seen="${person.appointmentId}">Seen</button>
                <button class="btn btn-sm btn-ghost" data-absent="${person.appointmentId}">Did not arrive</button>` : ''}</td>
        </tr>`;
    }).join('');

    const doneRows = (list, emptyNote) => list.length === 0
        ? `<p class="muted small" style="padding:10px 14px">${escape(emptyNote)}</p>`
        : list.map(person => `<div class="queue-done">
                ${personCell(person.patientPhoto, person.patientName, person.timeLabel)}
                <span class="qd-right">${escape(person.doctorName)} · ${statusBadge(person.status, person.statusLabel)}</span>
           </div>`).join('');

    const doctorChoices = (options.doctors || []).map(doctor =>
        `<option value="${escape(String(doctor.id))}"${String(options.doctorId) === String(doctor.id) ? ' selected' : ''}>Dr. ${escape(doctor.fullName)}</option>`).join('');

    return `
        <div class="card" style="margin-bottom:18px">
            <div class="card-head">
                <h3>Today at the clinic</h3>
                <div class="right queue-tools">
                    <label class="inline-field"><span>Day</span>
                        <input type="date" id="queueDate" value="${escape(data && data.date ? data.date : '')}">
                    </label>
                    ${doctorChoices ? `<label class="inline-field"><span>Doctor</span>
                        <select id="queueDoctor"><option value="">All doctors</option>${doctorChoices}</select>
                    </label>` : ''}
                    <button class="btn btn-sm" id="queueRefresh">Refresh</button>
                </div>
            </div>
            <div class="card-pad queue-summary">
                ${nowServingHtml(summary, escape, helpers.hourglass)}
                <div class="queue-stats">
                    <div class="qstat"><span class="qs-number">${escape(String(summary.waiting || 0))}</span><span class="qs-label">Still waiting</span></div>
                    <div class="qstat"><span class="qs-number">${escape(String(summary.seen || 0))}</span><span class="qs-label">Seen today</span></div>
                    <div class="qstat"><span class="qs-number">${escape(String(summary.booked || 0))}</span><span class="qs-label">Booked for the day</span></div>
                    <div class="qstat"><span class="qs-number">${escape(String(summary.estimatedClearMinutes || 0))}<small>min</small></span><span class="qs-label">Of consultations left</span></div>
                </div>
                <p class="queue-note">${escape(summary.waiting
                    ? 'Each consultation is planned for ' + (summary.averageMinutes || 15) + ' minutes. Urgent visits are called first.'
                    : 'Every patient of this clinic has been seen. Well done.')}</p>
            </div>
        </div>

        <div class="card">
            <div class="card-head">
                <h3>Waiting list</h3>
                <span class="sub">${waiting.length === 0
                    ? 'Nobody is waiting'
                    : waiting.length + ' patient' + (waiting.length === 1 ? '' : 's')
                      + ' · every doctor calls their own tokens in this order'}</span>
            </div>
            ${waiting.length === 0
                ? `<div class="empty"><span class="big">${helpers.hourglass || ''}</span>The waiting room is empty for this day</div>`
                : `<div class="table-wrap"><table class="data queue-table">
                        <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Booked time</th><th>Visit</th>${canManage ? '<th class="right">Actions</th>' : ''}</tr></thead>
                        <tbody>${rows}</tbody>
                   </table></div>`}
            <div class="queue-foot">
                <div class="qf-col">
                    <h4>Seen today</h4>
                    ${doneRows(seen, 'No consultation has been finished yet today.')}
                </div>
                <div class="qf-col">
                    <h4>Cancelled or not attended</h4>
                    ${doneRows(closed, 'Nobody missed an appointment today.')}
                </div>
            </div>
        </div>`;
}

/** Wires the waiting room board. */
export function bindQueueBoard(deps, root, options = {}) {
    const api = deps.api;
    const toast = deps.toast || (() => {});
    const reload = (extra = {}) => {
        const date = (root.querySelector('#queueDate') || {}).value || options.date || '';
        const doctorId = (root.querySelector('#queueDoctor') || {}).value || options.doctorId || '';
        if (typeof options.onChange === 'function') {
            options.onChange({ date, doctorId, ...extra });
        }
    };

    const dateField = root.querySelector('#queueDate');
    if (dateField) dateField.onchange = () => reload();
    const doctorField = root.querySelector('#queueDoctor');
    if (doctorField) doctorField.onchange = () => reload();
    const refresh = root.querySelector('#queueRefresh');
    if (refresh) refresh.onclick = () => reload();

    root.querySelectorAll('[data-open]').forEach(button => {
        button.onclick = () => {
            if (typeof options.onOpen === 'function') options.onOpen(button.dataset.open);
        };
    });

    root.querySelectorAll('[data-seen]').forEach(button => {
        button.onclick = () => {
            if (typeof options.onSeen === 'function') options.onSeen(button.dataset.seen);
        };
    });

    root.querySelectorAll('[data-absent]').forEach(button => {
        button.onclick = async () => {
            const id = button.dataset.absent;
            if (typeof options.confirm !== 'function' || !options.confirm(
                'Mark this visit as not attended?',
                'The appointment stays in the record as a missed visit and the time is freed for somebody else.')) {
                return;
            }
            try {
                const answer = await api(`/appointments/${id}/no-show`, { method: 'POST' });
                toast(answer.message || 'The visit is marked as not attended');
                reload({ reload: true });
            } catch (error) {
                toast(error.message || 'That could not be saved', 'error');
            }
        };
    });
}

/** The patient's own place in line. */
export function myPlaceHtml(data, helpers = {}) {
    const escape = helpers.escape || esc;
    if (!data || !data.hasAppointment) {
        return `<p class="muted small" style="margin:0">${escape((data && data.note)
            || 'You have no clinic visit waiting. Book an appointment whenever you need one.')}</p>`;
    }
    const token = data.token === null || data.token === undefined ? null : data.token;
    return `
        <div class="my-place">
            <div class="mp-token">
                <span class="mp-number">${token === null ? '-' : escape(String(token))}</span>
                <span class="mp-label">${token === null ? 'No token' : 'Your token'}</span>
            </div>
            <div class="mp-body">
                <div class="mp-line"><strong>${escape(data.doctorName || '')}</strong>
                    ${data.roomNo ? `<span class="muted small"> · ${escape(roomLabel(data.roomNo))}</span>` : ''}</div>
                <div class="mp-line small muted">${escape(data.date || '')} · ${escape(data.timeLabel || '')}</div>
                <div class="mp-note">${escape(data.note || '')}</div>
                ${data.estimatedWaitMinutes ? `<div class="mp-wait">${escape(waitText(data.estimatedWaitMinutes))} of consultations ahead of you</div>` : ''}
            </div>
        </div>`;
}

export default { queueBoardHtml, bindQueueBoard, myPlaceHtml, waitText };
