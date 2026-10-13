/* =============================================================================
   MedCare - Consulting hours pages
   =============================================================================
   Component 05 - Availability and Schedule: dated slots, the weekly schedule,
   blocking and unblocking.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function availabilityView(deps) {
    const { api, confirmDialog, esc, fail, fmtDate, fmtTime, go, lucide, modal, promptDialog, readForm, statusBadge, tableBlock, toast, todayISO, $, $$, MedCare } = deps;
    const links = deps.links || {};

/* =====================================================================
   CONSULTING HOURS - AVAILABILITY
   ================================================================== */
async function renderScheduleForm(container) {
    const isDoctor = deps.me.role === 'DOCTOR';
    const doctorList = isDoctor ? { doctors: [] } : await api('/doctors?activeOnly=true');
    container.innerHTML = `
        <div class="card">
            <div class="card-head"><h3>Create availability</h3>
                <span class="sub">Clashing times are not allowed, so the schedule always stays clear</span></div>
            <form id="slotForm" class="card-pad">
                <div class="form-row three">
                    ${isDoctor ? `<div class="field"><label>Doctor</label><input value="Dr. ${esc(deps.me.fullName)} (you)" disabled></div>`
                    : `<div class="field"><label>Doctor <span class="req">*</span></label>
                        <select name="doctorId" required>
                            <option value="">Select a doctor...</option>
                            ${doctorList.doctors.map(d => `<option value="${d.id}">Dr. ${esc(d.fullName)} — ${esc(d.specialization || '')}</option>`).join('')}
                        </select></div>`}
                    <div class="field"><label>Date <span class="req">*</span></label>
                        <input type="date" name="slotDate" required min="${todayISO()}" value="${todayISO()}"></div>
                    <div class="field"><label>Time window <span class="req">*</span></label>
                        <div class="flex">
                            <input type="time" name="startTime" required value="09:00">
                            <span class="muted">to</span>
                            <input type="time" name="endTime" required value="12:00">
                        </div></div>
                </div>
                <div class="field">
                    <label class="switch"><input type="checkbox" name="repeat" checked>
                        Split the window into individual consultation slots (recommended)</label>
                    <div class="hint">Each slot is created with the doctor's consultation duration, so 09:00-12:00 with a
                        30-minute consultation produces six 30-minute slots.</div>
                </div>
                <div class="field"><label>Remarks</label><input name="remarks" placeholder="e.g. Morning clinic session"></div>
                <div class="form-actions">
                    <button type="reset" class="btn">Clear</button>
                    <button type="submit" class="btn btn-primary">${lucide('clock', 'ico-16')} Create availability</button>
                </div>
            </form>
        </div>`;
    $('#slotForm', container).onsubmit = async event => {
        event.preventDefault();
        const payload = readForm($('#slotForm', container));
        if (isDoctor) payload.doctorId = deps.me.id;
        try {
            const result = await api('/slots', { method: 'POST', body: payload });
            toast(result.message + ' · doctor schedules updated');
            go('schedule');
        } catch (error) { fail(error); }
    };
}

async function renderSchedule(container) {
    const isDoctor = deps.me.role === 'DOCTOR';
    const doctorList = isDoctor ? { doctors: [] } : await api('/doctors');
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>${isDoctor ? 'My schedule' : 'Doctor schedules'}</h3><span class="sub" id="count"></span>
                <div class="right">
                    ${isDoctor ? '' : `<select id="doctorFilter" style="width:190px"><option value="">All doctors</option>
                        ${doctorList.doctors.map(d => `<option value="${d.id}">Dr. ${esc(d.fullName)}</option>`).join('')}</select>`}
                    <input type="date" id="fromFilter" style="width:160px" value="${todayISO()}">
                    <select id="statusFilter" style="width:150px">
                        <option value="">All statuses</option><option value="AVAILABLE">Available</option>
                        <option value="BLOCKED">Blocked</option><option value="BOOKED">Booked</option>
                    </select>
                    <button class="btn" id="clearFilter">Show all</button>
                    <button class="btn btn-primary btn-sm" id="newSlot">${lucide('clock', 'ico-16')} Create availability</button>
                </div>
            </div>
            <div id="slotTable"></div>
        </div>`;

    const load = async () => {
        const query = new URLSearchParams();
        const doctorFilter = $('#doctorFilter');
        if (doctorFilter && doctorFilter.value) query.set('doctorId', doctorFilter.value);
        if ($('#fromFilter').value) query.set('from', $('#fromFilter').value);
        if ($('#statusFilter').value) query.set('status', $('#statusFilter').value);
        $('#slotTable').innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Loading schedule...</span></div>';
        const data = await api('/slots?' + query.toString());
        $('#count').textContent = `${data.count} slot(s)`;
        $('#slotTable').innerHTML = tableBlock([
            { label: 'Date', cell: s => `<span class="cell-strong">${fmtDate(s.date)}</span>` },
            { label: 'Doctor', cell: s => `${esc(s.doctorName)}<span class="cell-sub">${esc(s.specialization || '')}</span>` },
            { label: 'Time', cell: s => `${fmtTime(s.startTime)} - ${fmtTime(s.endTime)}` },
            { label: 'Status', cell: s => statusBadge(s.status, s.statusLabel) + (s.remarks ? `<span class="cell-sub">${esc(s.remarks)}</span>` : '') },
            { label: '', right: true, cell: s => `<div class="row-actions">
                    ${s.status === 'AVAILABLE' ? `<button class="btn btn-sm" data-block="${s.id}">${lucide('calendar-x', 'ico-16')} Block</button>` : ''}
                    ${s.status === 'BLOCKED' ? `<button class="btn btn-sm" data-unblock="${s.id}">${lucide('check', 'ico-16')} Unblock</button>` : ''}
                    ${s.status !== 'BOOKED' ? `<button class="btn btn-sm" data-time="${s.id}" data-start="${s.startTime}" data-end="${s.endTime}">${lucide('clock', 'ico-16')} Change time</button>
                    <button class="btn btn-sm btn-danger" data-delete="${s.id}">${lucide('trash-2', 'ico-16')}</button>` : '<span class="small muted">Linked to an appointment</span>'}
                </div>` }
        ], data.slots, 'No slots match the current filters');

        $$('[data-block]', container).forEach(b => b.onclick = () => promptDialog({
            title: 'Block slot', label: 'Reason for blocking (optional)', required: false,
            placeholder: 'e.g. Doctor on leave', confirmLabel: 'Block slot',
            onConfirm: async reason => {
                try { const r = await api(`/slots/${b.dataset.block}/block`, { method: 'POST', body: { reason } }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); }
            }
        }));
        $$('[data-unblock]', container).forEach(b => b.onclick = async () => {
            try { const r = await api(`/slots/${b.dataset.unblock}/unblock`, { method: 'POST' }); toast(r.message); load(); } catch (e) { fail(e); }
        });
        $$('[data-time]', container).forEach(b => b.onclick = () => modal({
            title: 'Change slot time',
            body: `<div class="form-row">
                    <div class="field"><label>New start time</label><input type="time" id="newStart" value="${b.dataset.start}"></div>
                    <div class="field"><label>New end time</label><input type="time" id="newEnd" value="${b.dataset.end}"></div>
                   </div>`,
            footer: `<button class="btn" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Save time</button>`,
            onMount: (backdrop, close) => {
                $('[data-act="cancel"]', backdrop).onclick = close;
                $('[data-act="ok"]', backdrop).onclick = async () => {
                    try {
                        const r = await api(`/slots/${b.dataset.time}/time`, { method: 'POST', body: { startTime: $('#newStart', backdrop).value, endTime: $('#newEnd', backdrop).value } });
                        toast(r.message); close(); load();
                    } catch (e) { fail(e); }
                };
            }
        }));
        $$('[data-delete]', container).forEach(b => b.onclick = () => confirmDialog({
            title: 'Delete slot', message: 'Only unused (available or blocked) slots can be deleted. Continue?',
            confirmLabel: 'Delete slot',
            onConfirm: async () => { try { const r = await api(`/slots/${b.dataset.delete}`, { method: 'DELETE' }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); } }
        }));
    };

    if ($('#doctorFilter')) $('#doctorFilter').onchange = load;
    $('#fromFilter').onchange = load;
    $('#statusFilter').onchange = load;
    $('#clearFilter').onclick = () => { $('#fromFilter').value = ''; $('#statusFilter').value = ''; if ($('#doctorFilter')) $('#doctorFilter').value = ''; load(); };
    $('#newSlot').onclick = () => go('scheduleNew');
    await load();
}

    return { renderScheduleForm, renderSchedule };
}
