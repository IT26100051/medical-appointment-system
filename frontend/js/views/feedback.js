/* =============================================================================
   MedCare - Feedback and notification pages
   =============================================================================
   Component 06 - Feedback and Notifications: the feedback form, the review
   list and the notification inbox.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function feedbackView(deps) {
    const { api, confirmDialog, dash, esc, fail, fmtDate, fmtDateTime, fmtRelative, fmtTime, go, lucide, modal, promptDialog, readForm, refreshBell, stars, statusBadge, toast, visit, $, $$, MedCare , searchBox, bindSearch} = deps;
    const links = deps.links || {};

/* =====================================================================
   FEEDBACK & MESSAGES - FEEDBACK & NOTIFICATIONS
   ================================================================== */
async function renderFeedbackForm(container) {
    const data = await api('/feedback/eligible');
    container.innerHTML = `
        <div class="card">
            <div class="card-head"><h3>Rate a completed consultation</h3>
                <span class="sub">You can rate a consultation once the visit has taken place</span></div>
            ${(data.appointments || []).length === 0
                ? `<div class="empty"><span class="big">${lucide('clipboard-list', 'ico-32')}</span>No completed appointments are waiting for your feedback.
                    <div class="small mt-8">Feedback becomes available right after a consultation is marked completed.</div></div>`
                : `<div class="card-pad grid cols-3">
                    ${data.appointments.map(a => `
                        <div class="card card-pad" style="box-shadow:var(--shadow-sm)">
                            <div class="small muted mono">${esc(a.referenceNo)}</div>
                            <div style="font-weight:700; margin:4px 0">${esc(a.doctorName)}</div>
                            <div class="small muted">${esc(a.specialization || '')}</div>
                            <div class="small muted mt-8">${fmtDate(a.date)} · ${fmtTime(a.startTime)}</div>
                            <div class="small mt-8">${dash(a.reason)}</div>
                            <div class="mt-8"><button class="btn btn-primary btn-sm" data-review="${a.id}">${lucide('star', 'ico-16')} Give feedback</button></div>
                        </div>`).join('')}
                   </div>`}
        </div>`;
    $$('[data-review]', container).forEach(b => b.onclick = () => {
        const appointment = data.appointments.find(a => String(a.id) === b.dataset.review);
        openFeedbackModal(appointment, () => go('feedbackNew'));
    });
}

function openFeedbackModal(appointment, onDone) {
    let rating = 5;
    modal({
        title: 'Feedback for ' + (appointment.referenceNo || ''),
        subtitle: `${appointment.doctorName || ''} · ${fmtDate(appointment.date)}`,
        body: `
            <form id="feedbackForm">
                <input type="hidden" name="appointmentId" value="${appointment.id}">
                <input type="hidden" name="rating" id="ratingValue" value="5">
                <div class="field">
                    <label>Your rating <span class="req">*</span></label>
                    <div class="rating-input" id="ratingInput">
                        ${[1, 2, 3, 4, 5].map(i => `<span data-value="${i}" class="${i <= rating ? 'on' : ''}">${lucide('star', 'ico-16')}</span>`).join('')}
                    </div>
                </div>
                <div class="field"><label>Comments</label>
                    <textarea name="comments" placeholder="How was the consultation? Was the doctor helpful, was the clinic organised?"></textarea></div>
            </form>`,
        footer: `<button class="btn" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="ok">Submit feedback</button>`,
        onMount: (backdrop, close) => {
            $$('#ratingInput span', backdrop).forEach(star => star.onclick = () => {
                rating = Number(star.dataset.value);
                $('#ratingValue', backdrop).value = rating;
                $$('#ratingInput span', backdrop).forEach(s => s.classList.toggle('on', Number(s.dataset.value) <= rating));
            });
            $('[data-act="cancel"]', backdrop).onclick = close;
            $('[data-act="ok"]', backdrop).onclick = async () => {
                try {
                    const result = await api('/feedback', { method: 'POST', body: readForm($('#feedbackForm', backdrop)) });
                    toast(result.message + ' · feedback saved');
                    close();
                    if (onDone) await onDone();
                } catch (error) { fail(error); }
            };
        }
    });
}

async function renderFeedbackList(container) {
    const isDoctor = deps.me.role === 'DOCTOR';
    const doctorList = isDoctor ? { doctors: [] } : await api('/doctors');
    container.innerHTML = `
        <div class="card">
            <div class="card-head">
                <h3>${isDoctor ? 'Feedback about my consultations' : 'Patient feedback'}</h3>
                <span class="sub" id="summary"></span>
                <div class="right">
                    ${searchBox({ id: 'search', placeholder: 'Search patient, doctor, comment', label: 'Search feedback', size: 'lg' })}
                    ${isDoctor ? '' : `<select id="doctorFilter" style="width:190px"><option value="">All doctors</option>
                        ${doctorList.doctors.map(d => `<option value="${d.id}">Dr. ${esc(d.fullName)}</option>`).join('')}</select>`}
                    <select id="moderationFilter" style="width:150px">
                        <option value="">All</option><option value="VISIBLE">Visible</option><option value="HIDDEN">Hidden</option>
                    </select>
                </div>
            </div>
            <div id="feedbackList"></div>
        </div>`;

    let debounce = null;
    const load = async () => {
        const query = new URLSearchParams();
        if ($('#search').value.trim()) query.set('q', $('#search').value.trim());
        if ($('#moderationFilter').value) query.set('moderation', $('#moderationFilter').value);
        const doctorFilter = $('#doctorFilter');
        if (doctorFilter && doctorFilter.value) query.set('doctorId', doctorFilter.value);
        $('#feedbackList').innerHTML = '<div class="loading-block"><span class="spinner"></span><span>Loading feedback...</span></div>';
        const data = await api('/feedback?' + query.toString());
        $('#summary').textContent = `${data.count} entr(ies)` +
            (data.averageRating ? ` · average ${data.averageRating.toFixed(2)} / 5` : '');
        if (!data.feedback.length) {
            $('#feedbackList').innerHTML = `<div class="empty"><span class="big">${lucide('message-square-heart', 'ico-32')}</span>No feedback matches the current filters</div>`;
            return;
        }
        $('#feedbackList').innerHTML = data.feedback.map(f => `
            <div class="card-pad" style="border-bottom:1px solid var(--line)">
                <div class="flex flex-wrap">
                    <div>
                        <div class="flex">${stars(f.rating)}
                            <strong>${esc(f.patientName)}</strong>
                            <span class="muted small">about ${esc(f.doctorName)}</span>
                            ${statusBadge(f.moderation, f.moderationLabel)}
                        </div>
                        <div class="small muted mt-8">${esc(f.comments || 'No comment left')}</div>
                        <div class="small muted" style="margin-top:6px">
                            ${esc(f.appointmentRef)} · appointment ${fmtDate(f.appointmentDate)} · submitted ${fmtDateTime(f.createdAt)}
                            ${f.moderationNote ? ' · moderation note: ' + esc(f.moderationNote) : ''}
                        </div>
                    </div>
                    <div class="spacer"></div>
                    <div class="row-actions">
                        ${(deps.me.role === 'ADMIN') ? `<button class="btn btn-sm" data-edit="${f.id}" data-rating="${f.rating}"
                                data-comments="${esc(f.comments || '')}" data-appointment="${f.appointmentId}">${lucide('pencil', 'ico-16')} Edit</button>` : ''}
                        ${(f.moderation === 'VISIBLE' && (deps.me.role === 'ADMIN' || isDoctor))
                            ? `<button class="btn btn-sm" data-hide="${f.id}">${lucide('eye-off', 'ico-16')} Hide</button>` : ''}
                        ${(f.moderation === 'HIDDEN' && deps.me.role === 'ADMIN') ? `<button class="btn btn-sm btn-primary" data-restore="${f.id}">${lucide('rotate-ccw', 'ico-16')} Restore</button>` : ''}
                        ${deps.me.role === 'ADMIN' ? `<button class="btn btn-sm btn-danger" data-delete="${f.id}">${lucide('trash-2', 'ico-16')}</button>` : ''}
                    </div>
                </div>
            </div>`).join('');

        $$('[data-hide]', container).forEach(b => b.onclick = () => promptDialog({
            title: 'Hide feedback', label: 'Moderation note (reason)', required: false,
            placeholder: 'e.g. Contains personal information',
            confirmLabel: 'Hide', onConfirm: async note => {
                try { const r = await api(`/feedback/${b.dataset.hide}/hide`, { method: 'POST', body: { note } }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); }
            }
        }));
        $$('[data-restore]', container).forEach(b => b.onclick = async () => {
            try { const r = await api(`/feedback/${b.dataset.restore}/restore`, { method: 'POST' }); toast(r.message); load(); } catch (e) { fail(e); }
        });
        $$('[data-delete]', container).forEach(b => b.onclick = () => confirmDialog({
            title: 'Delete feedback', message: 'Permitted test feedback is removed; the action is recorded in the audit trail. Continue?',
            confirmLabel: 'Delete feedback',
            onConfirm: async () => { try { const r = await api(`/feedback/${b.dataset.delete}`, { method: 'DELETE' }); toast(r.message, 'warn'); load(); } catch (e) { fail(e); } }
        }));
        $$('[data-edit]', container).forEach(b => b.onclick = () => {
            let rating = Number(b.dataset.rating);
            modal({
                title: 'Edit feedback',
                body: `<form id="editFeedback">
                        <input type="hidden" name="appointmentId" value="${b.dataset.appointment}">
                        <input type="hidden" name="rating" id="editRating" value="${rating}">
                        <div class="field"><label>Rating</label>
                            <div class="rating-input" id="editRatingInput">
                                ${[1, 2, 3, 4, 5].map(i => `<span data-value="${i}" class="${i <= rating ? 'on' : ''}">${lucide('star', 'ico-16')}</span>`).join('')}
                            </div></div>
                        <div class="field"><label>Comments</label><textarea name="comments">${esc(b.dataset.comments)}</textarea></div>
                       </form>`,
                footer: `<button class="btn" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Save</button>`,
                onMount: (backdrop, close) => {
                    $$('#editRatingInput span', backdrop).forEach(star => star.onclick = () => {
                        rating = Number(star.dataset.value);
                        $('#editRating', backdrop).value = rating;
                        $$('#editRatingInput span', backdrop).forEach(s => s.classList.toggle('on', Number(s.dataset.value) <= rating));
                    });
                    $('[data-act="cancel"]', backdrop).onclick = close;
                    $('[data-act="ok"]', backdrop).onclick = async () => {
                        try { const r = await api(`/feedback/${b.dataset.edit}`, { method: 'PUT', body: readForm($('#editFeedback', backdrop)) }); toast(r.message); close(); load(); }
                        catch (e) { fail(e); }
                    };
                }
            });
        });
    };
    bindSearch(container, { id: 'search', onSearch: () => load() });
    $('#moderationFilter').onchange = load;
    if ($('#doctorFilter')) $('#doctorFilter').onchange = load;
    await load();
}

async function renderNotifications(container) {
    let unreadOnly = false;
    const paint = async () => {
        const data = await api('/notifications' + (unreadOnly ? '?unreadOnly=true' : ''));
        container.innerHTML = `
            <div class="card">
                <div class="card-head">
                    <h3>Notification inbox</h3>
                    <span class="sub">${data.unreadCount} unread of ${data.count} shown</span>
                    <div class="right">
                        <label class="switch"><input type="checkbox" id="unreadToggle" ${unreadOnly ? 'checked' : ''}> Unread only</label>
                        <button class="btn btn-sm" id="markAll">${lucide('check', 'ico-16')} Mark all read</button>
                    </div>
                </div>
                ${(data.notifications || []).length === 0
                    ? `<div class="empty"><span class="big">${lucide('bell', 'ico-32')}</span>Your inbox is empty</div>`
                    : data.notifications.map(n => `
                        <div class="notif-item ${n.read ? '' : 'unread'}">
                            <span class="notif-dot ${n.read ? 'read' : ''}"></span>
                            <div style="flex:1">
                                <div class="n-title">${esc(n.title)}
                                    <span class="badge grey plain" style="margin-left:6px">${esc(n.typeLabel)}</span></div>
                                <div class="n-msg">${esc(n.message)}</div>
                                <div class="n-meta" title="${esc(fmtDateTime(n.createdAt))}">${esc(fmtRelative(n.createdAt) || fmtDateTime(n.createdAt))}</div>
                            </div>
                            <div class="row-actions">
                                <button class="btn btn-sm" data-toggle="${n.id}" data-read="${n.read}">${n.read ? lucide('mail', 'ico-16') + ' Unread' : lucide('check', 'ico-16') + ' Read'}</button>
                                <button class="btn btn-sm btn-danger" data-del="${n.id}" ${n.read ? '' : 'disabled title="Mark as read first"'}>${lucide('trash-2', 'ico-16')}</button>
                            </div>
                        </div>`).join('')}
            </div>`;

        $('#unreadToggle').onchange = event => { unreadOnly = event.target.checked; paint(); };
        $('#markAll').onclick = async () => { try { const r = await api('/notifications/read-all', { method: 'POST' }); toast(r.message); refreshBell(); paint(); } catch (e) { fail(e); } };
        $$('[data-toggle]', container).forEach(b => b.onclick = async () => {
            try {
                const read = b.dataset.read === 'true';
                const r = await api(`/notifications/${b.dataset.toggle}/${read ? 'unread' : 'read'}`, { method: 'POST' });
                toast(r.message); refreshBell(); paint();
            } catch (e) { fail(e); }
        });
        $$('[data-del]', container).forEach(b => b.onclick = async () => {
            try { const r = await api(`/notifications/${b.dataset.del}`, { method: 'DELETE' }); toast(r.message, 'warn'); paint(); } catch (e) { fail(e); }
        });
    };
    await paint();
}

    return { renderFeedbackForm, openFeedbackModal, renderFeedbackList, renderNotifications };
}
