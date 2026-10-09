/* =============================================================================
   MedCare - staff accounts, my account and the clinic documents
   =============================================================================
   Component 04 - Access Control of the portal itself: the administrator's staff
   list, everybody's own account page, and the page that lists the plain text
   documents the clinic writes for every record.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back.
   ========================================================================== */

export function administrationView(deps) {
    const { api, attachPhotoBlock, confirmDialog, dash, esc, fail, fmtDateTime, go, lucide, modal, openPhotoWindow, personCell, photoBlockHtml, readForm, roleBadge, statusBadge, tableBlock, toast, $, $$, MedCare , searchBox, bindSearch} = deps;
    const links = deps.links || {};
    const { openPatientEdit, openDoctorEdit } = links;

        async function renderStaff(container) {
            container.innerHTML = `
                <div class="tabs">
                    <button class="tab active" data-tab="accounts">Staff accounts</button>
                    <button class="tab" data-tab="activity">Activity log</button>
                </div>
                <div id="staffPanel"></div>`;

            const panel = $('#staffPanel', container);
            $$('.tab', container).forEach(tab => tab.onclick = () => {
                $$('.tab', container).forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tab.dataset.tab === 'accounts' ? renderAccounts() : renderActivity();
            });

            async function renderAccounts() {
                panel.innerHTML = `
                    <div class="card">
                        <div class="card-head"><h3>Administrator & receptionist accounts</h3><span class="sub" id="count"></span>
                            <div class="right">
                                ${searchBox({ id: 'search', placeholder: 'Search name or username', label: 'Search staff accounts', size: 'lg' })}
                                <button class="btn btn-primary btn-sm" id="newStaff">${lucide('user-plus', 'ico-16')} Create staff account</button>
                            </div>
                        </div>
                        <div id="staffTable"></div>
                    </div>`;
                let debounce = null;
                const load = async () => {
                    const q = $('#search').value.trim();
                    const data = await api('/staff' + (q ? '?q=' + encodeURIComponent(q) : ''));
                    $('#count').textContent = `${data.count} account(s)`;
                    $('#staffTable').innerHTML = tableBlock([
                        { label: 'Name', cell: u => personCell(u.photo, u.fullName, u.username) },
                        { label: 'Role', cell: u => roleBadge(u.role) + `<span class="cell-sub">${esc(u.designation || '')}</span>` },
                        { label: 'Contact', cell: u => `${dash(u.phone)}<span class="cell-sub">${dash(u.email)}</span>` },
                        { label: 'Employee', cell: u => `${dash(u.employeeCode)}<span class="cell-sub">${u.counterNo ? 'Counter ' + esc(u.counterNo) : ''}</span>` },
                        { label: 'Status', cell: u => statusBadge(u.active ? 'ACTIVE' : 'INACTIVE') },
                        { label: '', right: true, cell: u => `<div class="row-actions">
                                <button class="btn btn-sm" data-photo="${u.id}" title="Change this person's picture">${lucide('camera', 'ico-16')} Picture</button>
                                <button class="btn btn-sm" data-edit="${u.id}">${lucide('pencil', 'ico-16')} Edit</button>
                                <button class="btn btn-sm" data-status="${u.id}" data-active="${!u.active}">${u.active ? lucide('user-x', 'ico-16') + ' Deactivate' : lucide('user-check', 'ico-16') + ' Activate'}</button>
                                <button class="btn btn-sm btn-danger" data-delete="${u.id}">${lucide('trash-2', 'ico-16')}</button></div>` }
                    ], data.staff, 'No staff accounts found');

                    $$('[data-photo]', panel).forEach(b => b.onclick = () => {
                        const account = data.staff.find(u => String(u.id) === b.dataset.photo);
                        openPhotoWindow(account, load);
                    });
                    $$('[data-edit]', panel).forEach(b => b.onclick = () => {
                        const account = data.staff.find(u => String(u.id) === b.dataset.edit);
                        openStaffModal(account, load);
                    });
                    $$('[data-status]', panel).forEach(b => b.onclick = async () => {
                        try { const r = await api(`/staff/${b.dataset.status}/status?active=${b.dataset.active}`, { method: 'POST' }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); }
                    });
                    $$('[data-delete]', panel).forEach(b => b.onclick = () => confirmDialog({
                        title: 'Delete or deactivate staff account',
                        message: 'Accounts with recorded activity are deactivated so the audit trail stays intact; unused test accounts are deleted.',
                        confirmLabel: 'Continue',
                        onConfirm: async () => { try { const r = await api(`/staff/${b.dataset.delete}`, { method: 'DELETE' }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); } }
                    }));
                };
                bindSearch(container, { id: 'search', onSearch: () => load() });
                $('#newStaff').onclick = () => openStaffModal(null, load);
                await load();
            }

            async function openStaffModal(account, onDone) {
                const editing = !!account;
                modal({
                    title: editing ? 'Edit staff account' : 'Create staff account',
                    subtitle: 'Reception and administrator accounts',
                    body: `
                        <form id="staffForm">
                            <div class="form-row three">
                                <div class="field"><label>Full name <span class="req">*</span></label>
                                    <input name="fullName" value="${editing ? esc(account.fullName) : ''}" required></div>
                                <div class="field"><label>Username <span class="req">*</span></label>
                                    <input name="username" value="${editing ? esc(account.username) : ''}" required></div>
                                <div class="field"><label>${editing ? 'New password' : 'Password'} ${editing ? '' : '<span class="req">*</span>'}</label>
                                    <div class="pwd-wrap"><input name="password" placeholder="${editing ? 'leave blank to keep current' : 'min 6 characters'}" ${editing ? '' : 'required'}>
                                        <button class="pwd-toggle" type="button" title="Show the password">${lucide('eye', 'ico-16')}</button></div></div>
                            </div>
                            <div class="form-row three">
                                <div class="field"><label>Role <span class="req">*</span></label>
                                    <select name="role" required>
                                        <option value="RECEPTIONIST" ${editing && account.role === 'RECEPTIONIST' ? 'selected' : ''}>Receptionist</option>
                                        <option value="ADMIN" ${editing && account.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
                                    </select></div>
                                <div class="field"><label>Designation</label>
                                    <input name="designation" value="${editing ? esc(account.designation || '') : ''}" placeholder="e.g. Front Desk Officer"></div>
                                <div class="field"><label>Employee code</label>
                                    <input name="employeeCode" value="${editing ? esc(account.employeeCode || '') : ''}" placeholder="EMP-004"></div>
                            </div>
                            <div class="form-row three">
                                <div class="field"><label>E-mail</label><input name="email" type="email" value="${editing ? esc(account.email || '') : ''}"></div>
                                <div class="field"><label>Phone</label><input name="phone" value="${editing ? esc(account.phone || '') : ''}"></div>
                                <div class="field"><label>Counter / desk</label><input name="counterNo" value="${editing ? esc(account.counterNo || '') : ''}"></div>
                            </div>
                            ${editing ? `<div class="field"><label class="switch"><input type="checkbox" name="active" ${account.active ? 'checked' : ''}> Account active</label></div>` : ''}
                        </form>`,
                    footer: `<button class="btn" data-act="cancel">Cancel</button>
                             <button class="btn btn-primary" data-act="ok">${editing ? lucide('save', 'ico-16') + ' Save changes' : lucide('user-plus', 'ico-16') + ' Create account'}</button>`,
                    onMount: (backdrop, close) => {
                        $('[data-act="cancel"]', backdrop).onclick = close;
                        $('[data-act="ok"]', backdrop).onclick = async () => {
                            const form = $('#staffForm', backdrop);
                            try {
                                const body = readForm(form);
                                const result = editing
                                    ? await api('/staff/' + account.id, { method: 'PUT', body })
                                    : await api('/staff', { method: 'POST', body });
                                toast(result.message + ' · staff records updated');
                                close();
                                await onDone();
                            } catch (error) { fail(error, form); }
                        };
                    }
                });
            }

            async function renderActivity() {
                panel.innerHTML = `
                    <div class="card">
                        <div class="card-head"><h3>Activity information</h3>
                            <span class="sub">The most recent activity in the clinic</span>
                            <div class="right">
                                ${searchBox({ id: 'userFilter', placeholder: 'Filter by username', label: 'Search the activity log', shortcut: '' })}
                                <button class="btn btn-sm" id="reloadActivity">⟳ Refresh</button>
                            </div>
                        </div>
                        <div class="card-pad"><div class="file-preview" id="activityBox">Loading...</div></div>
                    </div>`;
                const load = async () => {
                    const username = $('#userFilter').value.trim();
                    const data = await api('/staff/activity?' + (username ? 'username=' + encodeURIComponent(username) : ''));
                    $('#activityBox').textContent = (data.entries || []).join('\n') || 'No activity recorded yet.';
                };
                let debounce = null;
                bindSearch(container, { id: 'userFilter', onSearch: () => load(), shortcut: false });
                $('#reloadActivity').onclick = load;
                await load();
            }

            await renderAccounts();
        }
        async function renderAccount(container) {
            const data = await api('/auth/me');
            const u = data.user;
            container.innerHTML = `
                <div class="card" style="margin-bottom:18px">
                    <div class="card-pad">
                        ${photoBlockHtml(u, {
                            label: 'Your picture',
                            name: u.fullName,
                            role: `${u.accountType} · ${u.roleDisplay || u.role}`,
                            hint: 'Your picture is shown in the side bar, in the lists and on every appointment that involves you.'
                        })}
                    </div>
                </div>
                <div class="grid cols-2">
                    <div class="card">
                        <div class="card-head"><h3>Account details</h3><span class="sub">${esc(u.accountType)}</span></div>
                        <div class="card-pad">
                            <dl class="kv">
                                <dt>Full name</dt><dd>${dash(u.fullName)}</dd>
                                <dt>Username</dt><dd class="mono">${dash(u.username)}</dd>
                                <dt>Role</dt><dd>${roleBadge(u.role)} ${esc(u.roleDisplay || '')}</dd>
                                <dt>E-mail</dt><dd>${dash(u.email)}</dd>
                                <dt>Phone</dt><dd>${dash(u.phone)}</dd>
                                <dt>Status</dt><dd>${statusBadge(u.active ? 'ACTIVE' : 'INACTIVE')}</dd>
                                <dt>Registered</dt><dd>${fmtDateTime(u.createdAt)}</dd>
                                <dt>Last updated</dt><dd>${u.updatedAt ? fmtDateTime(u.updatedAt) : 'never'}</dd>
                            </dl>
                            ${['PATIENT', 'DOCTOR'].includes(deps.me.role)
                                ? `<div class="mt-16"><button class="btn btn-primary" id="editOwn">${lucide('pencil', 'ico-16')} Update my profile</button></div>`
                                : ''}
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-head"><h3>Change password</h3><span class="sub">Keep your account secure</span></div>
                        <form class="card-pad" id="passwordForm">
                            <div class="field"><label>Current password <span class="req">*</span></label>
                                <div class="pwd-wrap">
                                    <input type="password" name="currentPassword" required>
                                    <button class="pwd-toggle" type="button" title="Show the password">${lucide('eye', 'ico-16')}</button>
                                </div></div>
                            <div class="field"><label>New password <span class="req">*</span></label>
                                <div class="pwd-wrap">
                                    <input type="password" name="newPassword" required minlength="6">
                                    <button class="pwd-toggle" type="button" title="Show the password">${lucide('eye', 'ico-16')}</button>
                                </div>
                                <div class="hint">At least 6 characters. Passwords are stored as PBKDF2 hashes.</div></div>
                            <div class="form-actions"><button class="btn btn-primary" type="submit">Update password</button></div>
                        </form>
                    </div>
                </div>`;
            attachPhotoBlock(container, u, {
                onSaved: (user) => {
                    if (user && user.fullName) {
                        $('#sideName').textContent = user.fullName;
                    }
                    go('account');
                }
            });
            const editOwn = $('#editOwn', container);
            if (editOwn) editOwn.onclick = () => deps.me.role === 'PATIENT'
                ? openPatientEdit(deps.me.id, () => go('account'))
                : openDoctorEdit(deps.me.id, () => go('account'));
            $('#passwordForm', container).onsubmit = async event => {
                event.preventDefault();
                try {
                    const result = await api('/auth/change-password', { method: 'POST', body: readForm(event.target) });
                    toast(result.message);
                    event.target.reset();
                } catch (error) { fail(error); }
            };
        }
        async function renderReports(container) {
            const data = await api('/reports');
            const files = data.files || [];
            container.innerHTML = `
                <div class="card">
                    <div class="card-head">
                        <h3>Clinic documents</h3>
                        <span class="sub">Every record in the clinic is also written to a plain text file that can be
                            printed or attached to a report</span>
                        <div class="right">
                            <button class="btn btn-sm" id="refreshFiles">${lucide('refresh-cw', 'ico-16')} Regenerate all</button>
                        </div>
                    </div>
                    <div class="card-pad grid cols-2">
                        ${files.map(f => `
                            <div class="card" style="box-shadow:none">
                                <div class="card-head" style="padding:12px 14px">
                                    <div>
                                        <h3 style="font-size:14px">${esc(f.title)}</h3>
                                        <div class="sub">${esc(f.fileName)} · ${f.lineCount} lines · ${Math.ceil(f.sizeBytes / 1024)} KB
                                            ${f.exists ? '· updated ' + esc(f.lastModified) : '· not written yet'}</div>
                                    </div>
                                </div>
                                <div class="card-pad" style="padding:12px 14px">
                                    <div class="small muted" style="margin-bottom:8px">${esc(f.description)}</div>
                                    <div class="file-preview" style="max-height:150px">${esc((f.preview || []).join('\n')) || '(empty)'}</div>
                                    <div class="flex mt-8">
                                        <button class="btn btn-sm btn-primary" data-view="${f.key || f.fileName}">${lucide('file-text', 'ico-16')} Open</button>
                                        <a class="btn btn-sm" href="/api/reports/${f.key || f.fileName}/download">${lucide('download', 'ico-16')} Download</a>
                                    </div>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>`;
            $('#refreshFiles', container).onclick = async () => {
                try { const r = await api('/reports/refresh', { method: 'POST' }); toast(r.message); go('reports'); } catch (e) { fail(e); }
            };
            $$('[data-view]', container).forEach(b => b.onclick = async () => {
                const content = await api(`/reports/${b.dataset.view}/content`);
                modal({
                    title: content.title,
                    subtitle: `${content.fileName} · updated ${content.lastModified}`,
                    wide: true,
                    body: `<div class="file-preview tall">${esc(content.content)}</div>`,
                    footer: `<a class="btn btn-primary" href="/api/reports/${content.key || content.fileName}/download">${lucide('download', 'ico-16')} Download</a>
                             <button class="btn" data-act="close">Close</button>`,
                    onMount: (backdrop, close) => { $('[data-act="close"]', backdrop).onclick = close; }
                });
            });
        }

    return { renderStaff, renderAccount, renderReports };
}
