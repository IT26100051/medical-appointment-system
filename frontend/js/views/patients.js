/* =============================================================================
   MedCare - Patient pages
   =============================================================================
   Component 01 - Patient Management: register, search, profile and edit.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function patientsView(deps) {
    const { api, attachPhotoBlock, avatarHtml, confirmDialog, dash, esc, fail, fmtDate, fmtDateTime, fmtTime, go, lucide, modal, personCell, photoBlockHtml, readForm, relativeChip, statusBadge, tableBlock, toast, $, $$, MedCare , searchBox, bindSearch} = deps;
    const links = deps.links || {};

/* =====================================================================
   PATIENT RECORDS - PATIENTS
   ================================================================== */
function renderPatientForm(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>Register a new patient</h3>
                <span class="sub">New patient record</span>
            </div>
            <form id="patientForm" class="card-pad">
                <div class="small muted" style="margin-bottom:14px">
                    The account part below (name, username, password, contact) is inherited from
                    <strong>UserForm</strong>, the patient specific part is added by <strong>PatientForm</strong>.
                </div>
                <div class="form-row three">
                    <div class="field"><label>Full name <span class="req">*</span></label>
                        <input name="fullName" required placeholder="e.g. Nimasha Perera"></div>
                    <div class="field"><label>Username <span class="req">*</span></label>
                        <input name="username" required placeholder="4-50 letters/digits"></div>
                    <div class="field"><label>Password <span class="req">*</span></label>
                        <input name="password" type="text" required placeholder="min 6 characters"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>E-mail</label><input name="email" type="email" placeholder="name@example.com"></div>
                    <div class="field"><label>Phone</label><input name="phone" placeholder="+94 71 234 5678"></div>
                    <div class="field"><label>NIC</label><input name="nic" placeholder="947654321V"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Date of birth</label><input name="dateOfBirth" type="date"></div>
                    <div class="field"><label>Gender</label>
                        <select name="gender"><option value="">Select...</option>
                            <option>Female</option><option>Male</option><option>Other</option></select></div>
                    <div class="field"><label>Blood group</label>
                        <select name="bloodGroup"><option value="">Unknown</option>
                            <option>O+</option><option>O-</option><option>A+</option><option>A-</option>
                            <option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></div>
                </div>
                <div class="form-row">
                    <div class="field"><label>Address</label><input name="address" placeholder="House number, street"></div>
                    <div class="field"><label>City</label><input name="city" placeholder="e.g. Ratnapura"></div>
                </div>
                <div class="form-row">
                    <div class="field"><label>Emergency contact name</label>
                        <input name="emergencyContactName" placeholder="Name of the person to contact"></div>
                    <div class="field"><label>Emergency contact phone</label>
                        <input name="emergencyContactPhone" placeholder="+94 77 123 4567">
                        <div class="hint">Provide both the emergency name and phone, or leave both blank.</div></div>
                </div>
                <div class="field"><label>Medical notes / allergies</label>
                    <textarea name="medicalNotes" placeholder="Known allergies, chronic conditions, regular medication..."></textarea></div>
                <div class="field"><label class="switch"><input type="checkbox" name="active" checked>
                    Account is active (the patient can sign in and book appointments)</label></div>

                <div class="form-actions">
                    <button type="reset" class="btn">Clear</button>
                    <button type="submit" class="btn btn-primary">Register patient</button>
                </div>
            </form>
        </div>`;

    const form = $('#patientForm', container);
    form.onsubmit = async event => {
        event.preventDefault();
        const button = $('button[type=submit]', form);
        button.disabled = true;
        try {
            const payload = readForm(form);
            const result = await api('/patients', { method: 'POST', body: payload });
            toast(result.message + ' · saved to the patient records');
            go('patients');
        } catch (error) {
            fail(error, form);
            button.disabled = false;
        }
    };
}


async function renderPatients(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>Patients</h3>
                <span class="sub" id="count"></span>
                <div class="right">
                    ${searchBox({ id: 'search', placeholder: 'Search name, phone, NIC, e-mail', label: 'Search patient records', size: 'lg' })}
                    <select id="statusFilter" style="width:150px">
                        <option value="">All statuses</option>
                        <option value="ACTIVE">Active only</option>
                        <option value="INACTIVE">Deactivated</option>
                    </select>
                    <button class="btn btn-primary btn-sm" id="newPatient">${lucide('user-plus', 'ico-16')} Register patient</button>
                </div>
            </div>
            <div id="patientTable"></div>
        </div>`;

    let debounce = null;
    const load = async () => {
        const query = new URLSearchParams();
        const q = $('#search').value.trim();
        const status = $('#statusFilter').value;
        if (q) query.set('q', q);
        if (status) query.set('status', status);
        $('#patientTable').innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Loading patients...</span></div>';
        const data = await api('/patients?' + query.toString());
        $('#count').textContent = `${data.count} record(s)`;
        $('#patientTable').innerHTML = tableBlock([
            { label: 'Patient', cell: p => personCell(p.photo, p.fullName, `${p.city || '—'} · ${p.age ? p.age + ' yrs' : 'age not set'}`) },
            { label: 'Contact', cell: p => `${dash(p.phone)}<span class="cell-sub">${dash(p.email)}</span>` },
            { label: 'Profile', cell: p => `${dash(p.gender)}${p.age ? ', ' + p.age : ''}<span class="cell-sub">Blood group ${dash(p.bloodGroup)}</span>` },
            { label: 'Emergency', cell: p => p.emergencyContactName ? `${esc(p.emergencyContactName)}<span class="cell-sub">${esc(p.emergencyContactPhone || '')}</span>` : '<span class="muted">Not provided</span>' },
            { label: 'Status', cell: p => statusBadge(p.active ? 'ACTIVE' : 'INACTIVE') },
            { label: '', right: true, cell: p => `
                <div class="row-actions">
                    <button class="btn btn-sm" data-view="${p.id}">${lucide('eye', 'ico-16')} Profile</button>
                    <button class="btn btn-sm" data-edit="${p.id}">${lucide('pencil', 'ico-16')} Edit</button>
                    <button class="btn btn-sm ${p.active ? '' : 'btn-primary'}" data-status="${p.id}" data-active="${!p.active}">
                        ${p.active ? lucide('user-x', 'ico-16') + ' Deactivate' : lucide('user-check', 'ico-16') + ' Activate'}</button>
                    <button class="btn btn-sm btn-danger" data-delete="${p.id}">${lucide('trash-2', 'ico-16')}</button>
                </div>` }
        ], data.patients, 'No patients match the current search');

        $$('[data-view]', container).forEach(btn => btn.onclick = () => openPatientProfile(btn.dataset.view));
        $$('[data-edit]', container).forEach(btn => btn.onclick = () => openPatientEdit(btn.dataset.edit, load));
        $$('[data-status]', container).forEach(btn => btn.onclick = async () => {
            try {
                const result = await api(`/patients/${btn.dataset.status}/status?active=${btn.dataset.active}`, { method: 'POST' });
                toast(result.message); load();
            } catch (error) { fail(error); }
        });
        $$('[data-delete]', container).forEach(btn => btn.onclick = () => {
            confirmDialog({
                title: 'Delete or deactivate patient',
                message: 'Unused test records are removed. Patients with appointment history are deactivated so their history is preserved. Continue?',
                confirmLabel: 'Continue',
                onConfirm: async () => {
                    try { const result = await api(`/patients/${btn.dataset.delete}`, { method: 'DELETE' }); toast(result.message, 'warn'); load(); }
                    catch (error) { fail(error); }
                }
            });
        });
    };

    bindSearch(container, { id: 'search', onSearch: () => load() });
    $('#statusFilter').onchange = load;
    $('#newPatient').onclick = () => go('patientNew');
    await load();
}

async function openPatientProfile(id) {
    const data = await api('/patients/' + id);
    const p = data.patient;
    modal({
        title: p.fullName,
        subtitle: 'Patient profile · ' + (p.username || ''),
        wide: true,
        body: `
            <div class="grid cols-2">
                <div>
                    <div class="section-title" style="margin-top:0"><h2>Account</h2></div>
                    <dl class="kv">
                        <dt>Patient ID</dt><dd>#${p.id}</dd>
                        <dt>Full name</dt><dd>${dash(p.fullName)}</dd>
                        <dt>Username</dt><dd class="mono">${dash(p.username)}</dd>
                        <dt>E-mail</dt><dd>${dash(p.email)}</dd>
                        <dt>Phone</dt><dd>${dash(p.phone)}</dd>
                        <dt>Status</dt><dd>${statusBadge(p.active ? 'ACTIVE' : 'INACTIVE')}</dd>
                        <dt>Registered</dt><dd>${fmtDateTime(p.createdAt)}</dd>
                        <dt>Last updated</dt><dd>${p.updatedAt ? fmtDateTime(p.updatedAt) : 'never'}</dd>
                    </dl>
                </div>
                <div>
                    <div class="section-title" style="margin-top:0"><h2>Profile</h2></div>
                    <dl class="kv">
                        <dt>Date of birth</dt><dd>${fmtDate(p.dateOfBirth)}${p.age ? ' (' + p.age + ' years)' : ''}</dd>
                        <dt>Gender</dt><dd>${dash(p.gender)}</dd>
                        <dt>NIC</dt><dd class="mono">${dash(p.nic)}</dd>
                        <dt>Blood group</dt><dd>${dash(p.bloodGroup)}</dd>
                        <dt>Address</dt><dd>${dash(p.address)}${p.city ? ', ' + esc(p.city) : ''}</dd>
                        <dt>Emergency contact</dt><dd>${p.emergencyContactName ? esc(p.emergencyContactName) + ' · ' + esc(p.emergencyContactPhone || '') : 'Not provided'}</dd>
                        <dt>Medical notes</dt><dd>${dash(p.medicalNotes)}</dd>
                        <dt>Summary</dt><dd class="small muted">${esc(p.profileSummary || '')}</dd>
                    </dl>
                </div>
            </div>`,
        footer: `<button class="btn" data-act="close">Close</button>
                 <button class="btn btn-primary" data-act="edit">${lucide('pencil', 'ico-16')} Edit profile</button>`,
        onMount: (backdrop, close) => {
            $('[data-act="close"]', backdrop).onclick = close;
            $('[data-act="edit"]', backdrop).onclick = () => { close(); openPatientEdit(id, () => go('patients')); };
        }
    });
}

async function openPatientEdit(id, onDone) {
    const data = await api('/patients/' + id);
    const p = data.patient;
    modal({
        title: 'Update profile · ' + p.fullName,
        subtitle: 'Contact details, address, emergency contact and account status',
        wide: true,
        body: `
            <form id="editPatient">
                <div class="form-row three">
                    <div class="field"><label>Full name</label><input name="fullName" value="${esc(p.fullName)}" required></div>
                    <div class="field"><label>Username</label><input name="username" value="${esc(p.username)}" required></div>
                    <div class="field"><label>New password</label>
                        <div class="pwd-wrap"><input name="password" placeholder="leave blank to keep current">
                            <button class="pwd-toggle" type="button" title="Show the password">${lucide('eye', 'ico-16')}</button></div></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>E-mail</label><input name="email" type="email" value="${esc(p.email || '')}"></div>
                    <div class="field"><label>Phone</label><input name="phone" value="${esc(p.phone || '')}"></div>
                    <div class="field"><label>NIC</label><input name="nic" value="${esc(p.nic || '')}"></div>
                </div>
                <div class="form-row three">
                    <div class="field"><label>Date of birth</label><input name="dateOfBirth" type="date" value="${p.dateOfBirth || ''}"></div>
                    <div class="field"><label>Gender</label><select name="gender">
                        ${['', 'Female', 'Male', 'Other'].map(g => `<option value="${g}" ${p.gender === g ? 'selected' : ''}>${g || 'Select...'}</option>`).join('')}
                    </select></div>
                    <div class="field"><label>Blood group</label><input name="bloodGroup" value="${esc(p.bloodGroup || '')}"></div>
                </div>
                <div class="form-row">
                    <div class="field"><label>Address</label><input name="address" value="${esc(p.address || '')}"></div>
                    <div class="field"><label>City</label><input name="city" value="${esc(p.city || '')}"></div>
                </div>
                <div class="form-row">
                    <div class="field"><label>Emergency contact name</label><input name="emergencyContactName" value="${esc(p.emergencyContactName || '')}"></div>
                    <div class="field"><label>Emergency contact phone</label><input name="emergencyContactPhone" value="${esc(p.emergencyContactPhone || '')}"></div>
                </div>
                <div class="field"><label>Medical notes</label><textarea name="medicalNotes">${esc(p.medicalNotes || '')}</textarea></div>
                ${deps.me.role === 'PATIENT' ? '' : `
                <div class="field"><label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>
                    Account active</label></div>`}
            </form>`,
        footer: `<button class="btn" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="save">${lucide('save', 'ico-16')} Save changes</button>`,
        onMount: (backdrop, close) => {
            $('[data-act="cancel"]', backdrop).onclick = close;
            $('[data-act="save"]', backdrop).onclick = async () => {
                const form = $('#editPatient', backdrop);
                try {
                    const result = await api('/patients/' + id, { method: 'PUT', body: readForm(form) });
                    toast(result.message + ' · patient records updated');
                    close();
                    if (onDone) await onDone();
                } catch (error) { fail(error, form); }
            };
        }
    });
}

async function renderPatientProfile(container, id) {
    const patientId = id || deps.me.id;
    const data = await api('/patients/' + patientId);
    const p = data.patient;
    const ownRecord = patientId === deps.me.id;
    container.innerHTML = `
        <div class="card" style="margin-bottom:18px">
            <div class="card-pad">
                ${photoBlockHtml(p, {
                    label: ownRecord ? 'Your picture' : 'Patient picture',
                    name: ownRecord ? p.fullName : p.fullName,
                    role: `${p.gender || 'Patient'}${p.age ? ' · ' + p.age + ' years' : ''}${p.city ? ' · ' + p.city : ''}`,
                    hint: ownRecord
                        ? 'This picture appears on your appointments, in the clinic lists and beside your name. You can take a new one with your camera or choose one from the clinic.'
                        : 'The clinic can also set a picture for this patient. Only an administrator may change another person\'s picture.'
                })}
            </div>
        </div>
        <div class="grid cols-2">
            <div class="card">
                <div class="profile-head">
                    ${avatarHtml(p.photo, p.fullName, 92)}
                    <div>
                        <h3 style="margin:0">${deps.me.role === 'PATIENT' ? 'My profile' : esc(p.fullName)}</h3>
                        <div class="small muted">${esc(p.gender || '')}${p.age ? ' · ' + p.age + ' years' : ''}
                            ${p.bloodGroup ? ' · Blood group ' + esc(p.bloodGroup) : ''}</div>
                        <div class="mt-8 flex">
                            <button class="btn btn-sm btn-primary" id="editProfile">${lucide('pencil', 'ico-16')} Update profile</button>
                            ${deps.me.role === 'PATIENT' ? '' : `<button class="btn btn-sm" id="bookForPatient">${lucide('calendar-plus', 'ico-16')} Book appointment</button>`}
                        </div>
                    </div>
                </div>
                <div class="card-pad">
                    <dl class="kv">
                        <dt>Patient ID</dt><dd>#${p.id}</dd>
                        <dt>Full name</dt><dd>${dash(p.fullName)}</dd>
                        <dt>Username</dt><dd class="mono">${dash(p.username)}</dd>
                        <dt>E-mail</dt><dd>${dash(p.email)}</dd>
                        <dt>Phone</dt><dd>${dash(p.phone)}</dd>
                        <dt>Date of birth</dt><dd>${fmtDate(p.dateOfBirth)}${p.age ? ' (' + p.age + ' years)' : ''}</dd>
                        <dt>Gender</dt><dd>${dash(p.gender)}</dd>
                        <dt>NIC</dt><dd class="mono">${dash(p.nic)}</dd>
                        <dt>Address</dt><dd>${dash(p.address)}${p.city ? ', ' + esc(p.city) : ''}</dd>
                        <dt>Blood group</dt><dd>${dash(p.bloodGroup)}</dd>
                        <dt>Emergency contact</dt><dd>${p.emergencyContactName ? esc(p.emergencyContactName) + ' · ' + esc(p.emergencyContactPhone || '') : 'Not provided'}</dd>
                        <dt>Medical notes</dt><dd>${dash(p.medicalNotes)}</dd>
                        <dt>Account status</dt><dd>${statusBadge(p.active ? 'ACTIVE' : 'INACTIVE')}</dd>
                    </dl>
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h3>My appointments</h3>
                    <div class="right"><button class="btn btn-sm" id="toAppointments">Open appointment list</button></div>
                </div>
                <div id="myAppointments"><div class="loading-block"><span class="spinner"></span></div></div>
            </div>
        </div>`;
    attachPhotoBlock(container, p, {
        editable: ownRecord || deps.me.role === 'ADMIN',
        onSaved: () => go(deps.currentView === 'myProfile' ? 'myProfile' : 'patients')
    });
    $('#editProfile', container).onclick = () => openPatientEdit(p.id, () => go(deps.currentView === 'myProfile' ? 'myProfile' : 'patients'));
    const bookForPatient = $('#bookForPatient', container);
    if (bookForPatient) bookForPatient.onclick = () => go('appointmentNew', { patientId: p.id });
    $('#toAppointments', container).onclick = () => go('appointments');
    const appts = await api(`/appointments?patientId=${p.id}`);
    $('#myAppointments', container).innerHTML = tableBlock([
        { label: 'Reference', cell: a => `<span class="mono">${esc(a.referenceNo)}</span>` },
        { label: 'Doctor', cell: a => `${esc(a.doctorName)}<span class="cell-sub">${esc(a.specialization || '')}</span>` },
        { label: 'When', cell: a => `${fmtDate(a.date)} ${relativeChip(a.date, a.upcoming)}<span class="cell-sub">${fmtTime(a.startTime)}</span>` },
        { label: 'Status', cell: a => statusBadge(a.status, a.statusLabel) }
    ], appts.appointments || [], 'No appointments yet');
}

    return { renderPatientForm, renderPatients, openPatientProfile, openPatientEdit, renderPatientProfile };
}
