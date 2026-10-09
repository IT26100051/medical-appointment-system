import { roomLabel } from '../modules/labels.js';
/* =============================================================================
   MedCare - Doctor pages
   =============================================================================
   Component 02 - Doctor Management: register, list, profile, edit and one-tap booking.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function doctorsView(deps) {
    const { MedCare, api, attachPhotoBlock, avatarHtml, confirmDialog, dash, drawIcons, esc, fail, fmtDate, fmtTime, go, lucide, modal, personCell, photoBlockHtml, readForm, relativeChip, stars, statusBadge, tableBlock, toast, $, $$ , searchBox, bindSearch, enhanceSelect} = deps;
    const links = deps.links || {};

/* =====================================================================
   MEDICAL TEAM - DOCTORS
   ================================================================== */
function renderDoctorForm(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-head"><h3>Register a new doctor</h3><span class="sub">New member of the medical team</span></div>
            <form id="doctorForm" class="card-pad">
                <div class="small muted" style="margin-bottom:14px">
                    <strong>DoctorForm</strong> extends <strong>UserForm</strong>: the fields in the first three
                    rows are the shared account fields, the last rows are the doctor specific ones.
                </div>
                <div class="form-row three">
                    <div class="field"><label>Full name <span class="req">*</span></label><input name="fullName" required placeholder="e.g. Anura Silva"></div>
                    <div class="field"><label>Username <span class="req">*</span></label><input name="username" required></div>
                    <div class="field"><label>Password <span class="req">*</span></label><input name="password" type="text" required placeholder="min 6 characters"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>E-mail</label><input name="email" type="email"></div>
                    <div class="field"><label>Phone</label><input name="phone"></div>
                    <div class="field"><label>Room</label><input name="roomNo" placeholder="e.g. 12"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Specialization <span class="req">*</span></label>
                        <input name="specialization" required placeholder="e.g. Cardiologist" list="specList">
                        <datalist id="specList">
                            <option>General Physician</option><option>Cardiologist</option><option>Dermatologist</option>
                            <option>Paediatrician</option><option>Gynaecologist</option><option>Orthopaedic Surgeon</option>
                            <option>Neurologist</option><option>ENT Specialist</option><option>Ophthalmologist</option>
                            <option>Psychiatrist</option><option>Dentist</option>
                        </datalist></div>
                    <div class="field"><label>Qualifications</label><input name="qualifications" placeholder="MBBS, MD"></div>
                    <div class="field"><label>SLMC registration no</label><input name="registrationNo" placeholder="SLMC-12345"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Consultation duration (minutes) <span class="req">*</span></label>
                        <input name="consultationMinutes" type="number" min="5" max="120" value="30" required>
                        <div class="hint">Used to generate slots automatically (5-120).</div></div>
                    <div class="field"><label>Consultation fee</label><input name="consultationFee" type="number" step="0.01" min="0" placeholder="e.g. 3500"></div>
                    <div class="field" style="align-self:end"><label class="switch"><input type="checkbox" name="active" checked> Account active</label></div>
                </div>
                <div class="form-actions">
                    <button type="reset" class="btn">Clear</button>
                    <button type="submit" class="btn btn-primary">Register doctor</button>
                </div>
            </form>
        </div>`;
    const form = $('#doctorForm', container);
    form.onsubmit = async event => {
        event.preventDefault();
        const button = $('button[type=submit]', form);
        button.disabled = true;
        try {
            const result = await api('/doctors', { method: 'POST', body: readForm(form) });
            toast(result.message + ' · doctor records updated');
            go('doctors');
        } catch (error) { fail(error, form); button.disabled = false; }
    };
}

async function renderDoctors(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>Doctors</h3><span class="sub" id="count"></span>
                <div class="right">
                    ${searchBox({ id: 'search', placeholder: 'Search name, specialization, qualifications', label: 'Search the medical team', size: 'lg' })}
                    <select id="specFilter" style="width:190px"><option value="">All specializations</option></select>
                    <select id="statusFilter" style="width:150px">
                        <option value="">All statuses</option><option value="ACTIVE">Active only</option><option value="INACTIVE">Inactive</option>
                    </select>
                    ${deps.me.role === 'DOCTOR' ? '' : '<button class="btn btn-primary btn-sm" id="newDoctor">' + lucide('user-plus', 'ico-16') + ' Register doctor</button>'}
                </div>
            </div>
            <div id="doctorTable"></div>
        </div>`;

    let debounce = null;
    const load = async () => {
        const query = new URLSearchParams();
        const q = $('#search').value.trim();
        if (q) query.set('q', q);
        if ($('#specFilter').value) query.set('specialization', $('#specFilter').value);
        if ($('#statusFilter').value) query.set('status', $('#statusFilter').value);
        $('#doctorTable').innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Loading doctors...</span></div>';
        const data = await api('/doctors?' + query.toString());
        $('#count').textContent = `${data.count} doctor(s)`;
        const select = $('#specFilter');
        if (select.options.length <= 1 && data.specializations) {
            data.specializations.forEach(spec => select.add(new Option(spec, spec)));
        }
        $('#doctorTable').innerHTML = tableBlock([
            { label: 'Doctor', cell: d => personCell(d.photo, 'Dr. ' + d.fullName, d.specialization) },
            { label: 'Qualifications', cell: d => `${dash(d.qualifications)}<span class="cell-sub">${esc(d.registrationNo || '')}</span>` },
            { label: 'Contact', cell: d => `${dash(d.phone)}<span class="cell-sub">${dash(d.email)}</span>` },
            { label: 'Consultation', cell: d => `${d.consultationMinutes} min<span class="cell-sub">${d.consultationFee ? 'Fee ' + esc(d.consultationFee) : 'No fee set'}${d.roomNo ? ' · ' + esc(d.roomNo) : ''}</span>` },
            { label: 'Status', cell: d => statusBadge(d.active ? 'ACTIVE' : 'INACTIVE') },
            { label: '', right: true, cell: d => `
                <div class="row-actions">
                    <button class="btn btn-sm" data-view="${d.id}">${lucide('eye', 'ico-16')} Profile</button>
                    ${deps.me.role === 'DOCTOR' && d.id !== deps.me.id ? '' : `<button class="btn btn-sm" data-edit="${d.id}">${lucide('pencil', 'ico-16')} Edit</button>`}
                    ${deps.me.role === 'ADMIN' ? `<button class="btn btn-sm" data-status="${d.id}" data-active="${!d.active}">${d.active ? lucide('user-x', 'ico-16') + ' Deactivate' : lucide('user-check', 'ico-16') + ' Activate'}</button>
                    <button class="btn btn-sm btn-danger" data-delete="${d.id}">${lucide('trash-2', 'ico-16')}</button>` : ''}
                </div>` }
        ], data.doctors, 'No doctors match the current search');

        $$('[data-view]', container).forEach(b => b.onclick = () => openDoctorProfile(b.dataset.view));
        $$('[data-edit]', container).forEach(b => b.onclick = () => openDoctorEdit(b.dataset.edit, load));
        $$('[data-status]', container).forEach(b => b.onclick = async () => {
            try { const r = await api(`/doctors/${b.dataset.status}/status?active=${b.dataset.active}`, { method: 'POST' }); toast(r.message, 'warn'); load(); }
            catch (error) { fail(error); }
        });
        $$('[data-delete]', container).forEach(b => b.onclick = () => confirmDialog({
            title: 'Delete or deactivate doctor',
            message: 'Doctors with appointment history are deactivated (history preserved) and unused test records are deleted. Continue?',
            confirmLabel: 'Continue',
            onConfirm: async () => { try { const r = await api(`/doctors/${b.dataset.delete}`, { method: 'DELETE' }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); } }
        }));
    };
    bindSearch(container, { id: 'search', onSearch: () => load() });
    $('#specFilter').onchange = load;
    $('#statusFilter').onchange = load;
    const newBtn = $('#newDoctor');
    if (newBtn) newBtn.onclick = () => go('doctorNew');
    await load();
}

async function openDoctorProfile(id) {
    const data = await api('/doctors/' + id);
    const d = data.doctor;
    const reviews = data.reviews || [];
    modal({
        title: 'Dr. ' + d.fullName,
        subtitle: (d.specialization || '') + (d.qualifications ? ' · ' + d.qualifications : ''),
        wide: true,
        body: `
            <div class="ph-block" style="margin-bottom:14px">
                <div class="ph-face">
                    <div class="avatar-lg face-zoom">${avatarHtml(d.photo, d.fullName, 118)}</div>
                </div>
                <div class="ph-name">
                    <div class="ph-role">${esc(d.specialization || '')}${d.roomNo ? ' · ' + esc(roomLabel(d.roomNo)) : ''}</div>
                    <div class="ph-actions">
                        <button class="btn btn-sm btn-primary" data-act="book">
                            ${lucide('calendar-plus', 'ico-16')} Book an appointment</button>
                        <button class="btn btn-sm" data-nav="doctors">
                            ${lucide('list', 'ico-16')} Back to the medical team</button>
                    </div>
                    <div class="ph-hint">Free times below come straight from the clinic's consulting hours.</div>
                </div>
            </div>
            <div class="grid cols-2">
                <div>
                    <dl class="kv">
                        <dt>Doctor ID</dt><dd>#${d.id}</dd>
                        <dt>Specialization</dt><dd>${dash(d.specialization)}</dd>
                        <dt>Qualifications</dt><dd>${dash(d.qualifications)}</dd>
                        <dt>SLMC no</dt><dd class="mono">${dash(d.registrationNo)}</dd>
                        <dt>Consultation</dt><dd>${d.consultationMinutes} minutes</dd>
                        <dt>Fee</dt><dd>${d.consultationFee ? esc(d.consultationFee) : 'not set'}</dd>
                        <dt>Room</dt><dd>${dash(d.roomNo)}</dd>
                        <dt>Contact</dt><dd>${dash(d.phone)}<div class="small muted">${dash(d.email)}</div></dd>
                        <dt>Status</dt><dd>${statusBadge(d.active ? 'ACTIVE' : 'INACTIVE')}</dd>
                        <dt>Rating</dt><dd>${data.averageRating ? stars(Math.round(data.averageRating)) + ' ' + data.averageRating.toFixed(2) + ' / 5' : '<span class="muted">no ratings yet</span>'}</dd>
                    </dl>
                </div>
                <div>
                    <div class="section-title" style="margin-top:0"><h2>Next available slots</h2></div>
                    ${(data.upcomingSlots || []).length === 0
                        ? '<p class="muted small">No open slots. Create availability from the schedule page.</p>'
                        : `<div class="slot-grid">${data.upcomingSlots.slice(0, 9).map(s => `
                            <button class="slot-btn" type="button" data-bookslot="${s.id}">
                                <span>${esc(s.startTime)}</span><span class="sl-sub">${fmtDate(s.date)}</span>
                            </button>`).join('')}</div>
                           <div class="hint small mt-8">Select a time to book it straight away.</div>`}
                    <div class="section-title"><h2>Patient feedback</h2></div>
                    ${reviews.length === 0 ? '<p class="muted small">No visible feedback yet.</p>'
                        : reviews.slice(0, 4).map(r => `<div style="border-bottom:1px solid var(--line); padding:8px 0">
                            <div class="flex">${stars(r.rating)}<span class="small muted">${esc(r.patientName)} · ${fmtDate((r.appointmentDate || '').substring(0, 10))}</span></div>
                            <div class="small">${esc(r.comments || '')}</div></div>`).join('')}
                </div>
            </div>`,
        footer: `<button class="btn" data-act="close">Close</button>
                 ${(deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST' || (deps.me.role === 'DOCTOR' && deps.me.id === d.id))
                    ? `<button class="btn btn-primary" data-act="edit">${lucide('pencil', 'ico-16')} Edit profile</button>` : ''}`,
        onMount: (backdrop, close) => {
            $('[data-act="close"]', backdrop).onclick = close;
            const editBtn = $('[data-act="edit"]', backdrop);
            if (editBtn) editBtn.onclick = () => { close(); openDoctorEdit(id, () => go('doctors')); };
            const backBtn = $('[data-nav="doctors"]', backdrop);
            if (backBtn) backBtn.onclick = () => { close(); go('doctors'); };
            const book = $('[data-act="book"]', backdrop);
            if (book) book.onclick = () => { close(); quickBook({ doctorId: id }); };
            $$('[data-bookslot]', backdrop).forEach(button => button.onclick = () => {
                close();
                quickBook({ doctorId: id, slotId: button.dataset.bookslot });
            });
        }
    });
}

/**
 * Opens the booking desk as a window with a doctor (and often a time)
 * already chosen - the "book in one tap" path every modern booking site has.
 */
function quickBook(seed = {}) {
    if (MedCare && typeof MedCare.openBookingDesk === 'function') {
        MedCare.openBookingDesk({
            modal, api, toast, drawIcons, escape: esc, avatar: avatarHtml, me: deps.me, enhanceSelect,
            refresh: () => go('appointments')
        }, seed);
    } else {
        go('appointmentNew', seed);
    }
}

async function openDoctorEdit(id, onDone) {
    const data = await api('/doctors/' + id);
    const d = data.doctor;
    const isSelf = deps.me.role === 'DOCTOR' && deps.me.id === d.id;
    modal({
        title: 'Update profile · Dr. ' + d.fullName,
        subtitle: 'Speciality, qualifications, consultation duration and account status',
        wide: true,
        body: `
            <form id="editDoctor">
                <div class="form-row three">
                    <div class="field"><label>Full name</label><input name="fullName" value="${esc(d.fullName)}" required></div>
                    <div class="field"><label>Username</label><input name="username" value="${esc(d.username)}" required ${isSelf ? 'readonly' : ''}></div>
                    <div class="field"><label>New password</label>
                        <div class="pwd-wrap"><input name="password" placeholder="leave blank to keep current">
                            <button class="pwd-toggle" type="button" title="Show the password">${lucide('eye', 'ico-16')}</button></div></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>E-mail</label><input name="email" type="email" value="${esc(d.email || '')}"></div>
                    <div class="field"><label>Phone</label><input name="phone" value="${esc(d.phone || '')}"></div>
                    <div class="field"><label>Room</label><input name="roomNo" value="${esc(d.roomNo || '')}"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Specialization</label><input name="specialization" value="${esc(d.specialization || '')}" required></div>
                    <div class="field"><label>Qualifications</label><input name="qualifications" value="${esc(d.qualifications || '')}"></div>
                    <div class="field"><label>SLMC no</label><input name="registrationNo" value="${esc(d.registrationNo || '')}"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Consultation duration (minutes)</label>
                        <input name="consultationMinutes" type="number" min="5" max="120" value="${d.consultationMinutes || 30}" required></div>
                    <div class="field"><label>Consultation fee</label><input name="consultationFee" type="number" step="0.01" value="${d.consultationFee || ''}"></div>
                    <div class="field" style="align-self:end">${isSelf ? '' :
                        `<label class="switch"><input type="checkbox" name="active" ${d.active ? 'checked' : ''}> Account active</label>`}</div>
                </div>
            </form>`,
        footer: `<button class="btn" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="save">${lucide('save', 'ico-16')} Save changes</button>`,
        onMount: (backdrop, close) => {
            $('[data-act="cancel"]', backdrop).onclick = close;
            $('[data-act="save"]', backdrop).onclick = async () => {
                const form = $('#editDoctor', backdrop);
                try {
                    const result = await api('/doctors/' + id, { method: 'PUT', body: readForm(form) });
                    toast(result.message + ' · doctor records updated');
                    close();
                    if (onDone) await onDone();
                } catch (error) { fail(error, form); }
            };
        }
    });
}

async function renderDoctorProfile(container, id) {
    const doctorId = id || deps.me.id;
    const data = await api('/doctors/' + doctorId);
    const d = data.doctor;
    const mine = await api(`/appointments?doctorId=${doctorId}`);
    container.innerHTML = `
        <div class="card" style="margin-bottom:18px">
            <div class="card-pad">
                ${photoBlockHtml(d, {
                    label: doctorId === deps.me.id ? 'Your picture' : 'Doctor picture',
                    name: 'Dr. ' + d.fullName,
                    role: [d.specialization, roomLabel(d.roomNo) || null].filter(Boolean).join(' · '),
                    editable: doctorId === deps.me.id || deps.me.role === 'ADMIN',
                    hint: (doctorId === deps.me.id || deps.me.role === 'ADMIN')
                        ? 'A clear photograph of the doctor is shown on the clinic website and beside every appointment.'
                        : 'This picture was set by the clinic and cannot be changed from here.'
                })}
            </div>
        </div>
        <div class="grid cols-2">
            <div class="card">
                <div class="profile-head">
                        <div class="small muted">${esc(d.specialization || '')}${d.roomNo ? ' · ' + esc(d.roomNo) : ''}
                            ${d.registrationNo ? ' · ' + esc(d.registrationNo) : ''}</div>
                        <div class="mt-8 flex">
                            <button class="btn btn-sm btn-primary" id="editDoctorBtn">${lucide('pencil', 'ico-16')} Update profile</button>
                            ${deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST' || deps.me.role === 'PATIENT'
                                ? `<button class="btn btn-sm" id="bookWithDoctor">${lucide('calendar-plus', 'ico-16')} Book with this doctor</button>` : ''}
                        </div>
                    </div>
                </div>
                <div class="card-pad">
                    <dl class="kv">
                        <dt>Specialization</dt><dd>${dash(d.specialization)}</dd>
                        <dt>Qualifications</dt><dd>${dash(d.qualifications)}</dd>
                        <dt>SLMC registration</dt><dd class="mono">${dash(d.registrationNo)}</dd>
                        <dt>Consultation duration</dt><dd>${d.consultationMinutes} minutes</dd>
                        <dt>Consultation fee</dt><dd>${d.consultationFee ? esc(d.consultationFee) : 'not set'}</dd>
                        <dt>Room</dt><dd>${dash(d.roomNo)}</dd>
                        <dt>E-mail</dt><dd>${dash(d.email)}</dd>
                        <dt>Phone</dt><dd>${dash(d.phone)}</dd>
                        <dt>Status</dt><dd>${statusBadge(d.active ? 'ACTIVE' : 'INACTIVE')}</dd>
                        <dt>Average rating</dt><dd>${data.averageRating ? stars(Math.round(data.averageRating)) + ' ' + data.averageRating.toFixed(2) : '<span class="muted">no ratings yet</span>'}</dd>
                    </dl>
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h3>My appointments</h3></div>
                ${tableBlock([
                    { label: 'Reference', cell: a => `<span class="mono">${esc(a.referenceNo)}</span>` },
                    { label: 'Patient', cell: a => esc(a.patientName) },
                    { label: 'When', cell: a => `${fmtDate(a.date)} ${relativeChip(a.date, a.upcoming)}<span class="cell-sub">${fmtTime(a.startTime)}</span>` },
                    { label: 'Status', cell: a => statusBadge(a.status, a.statusLabel) }
                ], mine.appointments || [], 'No appointments yet')}
            </div>
        </div>`;
    attachPhotoBlock(container, d, {
        editable: doctorId === deps.me.id || deps.me.role === 'ADMIN',
        onSaved: () => go('doctorProfile')
    });
    $('#editDoctorBtn', container).onclick = () => openDoctorEdit(doctorId, () => go('doctorProfile'));
    const bookWithDoctor = $('#bookWithDoctor', container);
    if (bookWithDoctor) {
        // Booking straight from a doctor's page: the desk opens as a window
        // with that doctor already chosen and their free times loaded.
        bookWithDoctor.onclick = () => {
            if (MedCare && typeof MedCare.openBookingDesk === 'function') {
                MedCare.openBookingDesk({
                    modal, api, toast, drawIcons, escape: esc, avatar: avatarHtml, me: deps.me, enhanceSelect,
                    refresh: () => go('appointments')
                }, { doctorId });
            } else {
                go('appointmentNew', { doctorId });
            }
        };
    }
}

    return { renderDoctorForm, renderDoctors, openDoctorProfile, quickBook, openDoctorEdit, renderDoctorProfile };
}
