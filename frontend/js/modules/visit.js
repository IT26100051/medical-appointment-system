import { roomLabel } from './labels.js';
/* =============================================================================
   MedCare front end - the visit itself
   -----------------------------------------------------------------------------
   Three pieces of markup that belong to a real hospital portal, used by the
   appointment pages:

     * the check-in pass  - what the patient shows at the desk on arrival, with
       the reference number drawn as a code, and a button to download or print it;
     * the visit summary  - what the doctor wrote down after the consultation,
       plus the follow-up plan when there is one;
     * the visit history  - the person's earlier visits, newest first, drawn as a
       timeline so a doctor can see the story at a glance.
   ========================================================================== */

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function priorityPill(label, priority) {
    const kind = priority === 'URGENT' ? 'is-urgent' : priority === 'FOLLOW_UP' ? 'is-follow' : 'is-routine';
    const icon = priority === 'URGENT' ? 'alert-triangle' : priority === 'FOLLOW_UP' ? 'repeat' : 'calendar-check';
    return `<span class="priority-pill ${kind}"><i data-lucide="${icon}" class="ico-14"></i> ${escapeHtml(label)}</span>`;
}

/**
 * The check-in pass.
 *
 * @param {object} pass  what the server sends from the appointment pass endpoint
 * @param {object} deps  { escape?, qr? }  - qr() returns the SVG text for a code
 */
export function passHtml(pass, deps = {}) {
    const escape = deps.escape || escapeHtml;
    const code = typeof deps.qr === 'function' ? deps.qr(pass.referenceNo) : '';
    // The code itself is drawn by the page (a code library may hand it back
    // asynchronously); the pass only provides the frame for it.
    const codeBlock = `<div class="pass-code" data-pass-code>${code || ''}</div>`;
    return `
    <div class="pass-card" data-pass>
        <div class="pass-top">
            <div>
                <p class="pass-title">Check-in pass</p>
                <p class="pass-sub">${escape(pass.patientName)} · ${escape(pass.date)} · ${escape(pass.timeLabel)}</p>
            </div>
            ${codeBlock}
        </div>
        <div class="pass-body">
            <div class="pb-cell"><span>Reference</span><strong>${escape(pass.referenceNo)}</strong></div>
            <div class="pb-cell"><span>Doctor</span><strong>${escape(pass.doctorName)}</strong></div>
            <div class="pb-cell"><span>Where</span><strong>${escape(roomLabel(pass.roomNo) || pass.specialization || 'Consulting rooms')}</strong></div>
            <div class="pb-cell"><span>Status</span><strong>${escape(pass.statusLabel)}</strong></div>
            <div class="pb-cell"><span>Visit type</span><strong>${escape(pass.priorityLabel || 'Routine')}</strong></div>
            ${pass.followUpDate ? `<div class="pb-cell"><span>Follow-up</span><strong>${escape(pass.followUpDate)}</strong></div>` : ''}
        </div>
        <div class="pass-foot">
            <span class="pass-note">${escape(pass.arrivalNote || '')}</span>
            <span style="margin-left:auto"></span>
            <button class="btn btn-ghost btn-sm" data-pass-save type="button">
                <i data-lucide="download" class="ico-16"></i> Save the pass
            </button>
            <button class="btn btn-ghost btn-sm" data-pass-print type="button">
                <i data-lucide="printer" class="ico-16"></i> Print
            </button>
        </div>
    </div>`;
}

/** What the doctor wrote down, plus the follow-up plan. */
export function summaryHtml(appointment, deps = {}) {
    const escape = deps.escape || escapeHtml;
    if (!appointment) {
        return '';
    }
    const hasText = appointment.visitSummary && String(appointment.visitSummary).trim();
    const hasNotes = appointment.notes && String(appointment.notes).trim();
    if (!hasText && !hasNotes && !appointment.followUpDate) {
        return `<div class="summary-card"><h4><i data-lucide="file-text" class="ico-18"></i> Visit summary</h4>
            <p class="summary-empty">The doctor has not written the summary for this visit yet. It appears here
                as soon as the consultation is closed.</p></div>`;
    }
    return `
    <div class="summary-card" data-visit-summary>
        <h4><i data-lucide="file-text" class="ico-18"></i> Visit summary</h4>
        ${hasText ? `<div class="sm-text">${escape(appointment.visitSummary)}</div>` : ''}
        ${hasNotes ? `<div class="sm-text" style="margin-top:10px; color:var(--muted)">Doctor's notes: ${escape(appointment.notes)}</div>` : ''}
        ${appointment.followUpDate ? `
            <div class="summary-follow">
                <i data-lucide="calendar-clock" class="ico-22"></i>
                <div>
                    <strong>Come back on ${escape(appointment.followUpDate)}</strong>
                    <span>${escape(appointment.followUpNotes || 'The clinic will confirm the time with you.')}</span>
                </div>
            </div>` : ''}
    </div>`;
}

/** The person's earlier visits, newest first. */
export function historyHtml(appointments, deps = {}) {
    const escape = deps.escape || escapeHtml;
    const rows = (appointments || []).filter(a => a && a.status !== 'CANCELLED');
    if (!rows.length) {
        return `<p class="summary-empty">No earlier visits recorded.</p>`;
    }
    return `<ul class="timeline">${rows.slice(0, 6).map((visit) => `
        <li class="${visit.status === 'COMPLETED' ? 'is-done' : ''}">
            <div class="tl-when">${escape(visit.date)} · ${escape(visit.startTime)}</div>
            <div class="tl-what">Dr. ${escape(String(visit.doctorName || '').replace(/^Dr\.\s*/, ''))} — ${escape(visit.statusLabel)}</div>
            <div class="tl-when">${escape(visit.reason || visit.specialization || '')}</div>
        </li>`).join('')}</ul>`;
}

/** A small "in 2 days" style mark used on the next-visit card. */
export function countdownText(daysAway) {
    if (daysAway === null || daysAway === undefined) {
        return '';
    }
    const days = Number(daysAway);
    if (days === 0) {
        return 'Today';
    }
    if (days === 1) {
        return 'Tomorrow';
    }
    if (days < 0) {
        return `${Math.abs(days)} day(s) ago`;
    }
    if (days > 30) {
        return 'in more than a month';
    }
    return `in ${days} days`;
}

export { priorityPill, escapeHtml };
