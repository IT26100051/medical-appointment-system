/* =============================================================================
   MedCare - the waiting list page
   =============================================================================
   Component 03 - Appointment Management (the waiting list).

   When no suitable time is free, a patient takes a place on the doctor's
   waiting list. The clinic sees the whole list and offers free times as they
   come up; the patient sees only their own places and may leave the list.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back.
   ========================================================================== */

import { openJoinWaitlist, waitingListInvite } from '../modules/waitlist.js';

export function waitlistView(deps) {
    const { $, $$, api, confirmDialog, drawIcons, esc, fail, fmtDate, go, lucide, modal,
            personCell, searchBox, bindSearch, statusBadge, tableBlock, toast } = deps;

    const isPatient = () => deps.me.role === 'PATIENT';
    const isStaff = () => deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST';

    /** The small badge that says where a place on the list stands. */
    function stateBadge(entry) {
        return statusBadge(entry.status, entry.statusLabel);
    }

    async function renderWaitlist(container, params = {}) {
        const openOnly = params.show !== 'all';
        const [board, doctorData] = await Promise.all([
            api(`/waitlist?openOnly=${openOnly ? 'true' : 'false'}`),
            isStaff() ? api('/doctors?activeOnly=true') : Promise.resolve({ doctors: [] })
        ]);
        const entries = board.entries || [];
        const waiting = board.waiting || 0;
        const doctors = (doctorData.doctors || []).map(doctor => ({
            id: doctor.id, fullName: doctor.fullName, specialization: doctor.specialization
        }));

        container.innerHTML = `
            <div class="card card-pad hero-panel" style="position:relative; overflow:hidden">
                <div class="flex flex-wrap" style="align-items:center; gap:14px">
                    <div>
                        <div style="font-size:12.5px; text-transform:uppercase; letter-spacing:.14em; opacity:.8">
                            ${isPatient() ? 'Your places in the queue' : 'Waiting list'}</div>
                        <div style="font-size:23px; font-weight:700; margin-top:4px">
                            ${isPatient()
                                ? 'We will tell you the moment a time frees up'
                                : waiting + (waiting === 1 ? ' patient is waiting' : ' patients are waiting')}
                        </div>
                        <div class="small" style="opacity:.9; margin-top:4px">
                            ${isPatient()
                                ? 'A place on the list holds your turn — a free time is offered to you first.'
                                : 'The patient who has waited longest is offered the first free time.'}
                        </div>
                    </div>
                    <div class="spacer"></div>
                    <div class="flex" style="gap:8px; align-items:center">
                        ${lucide('list-ordered', 'ico-28')}
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-head flex flex-wrap" style="gap:10px; align-items:center; justify-content:space-between">
                    <div>
                        <h3 style="margin:0">${isPatient() ? 'My waiting list' : 'Who is waiting'}</h3>
                        <div class="sub">${entries.length} ${entries.length === 1 ? 'place' : 'places'}
                            ${openOnly ? 'still open' : 'in total'}${isPatient() ? ' in your name' : ''}</div>
                    </div>
                    <div class="flex" style="gap:10px; align-items:center; flex-wrap:wrap">
                        ${searchBox({ id: 'waitSearch', placeholder: 'Search patient or doctor',
                                      label: 'Search the waiting list', shortcut: '' })}
                        <button class="btn btn-sm" data-show="${openOnly ? 'all' : 'open'}">
                            ${openOnly ? 'Show history too' : 'Show only open'}</button>
                    </div>
                </div>
                <div class="card-pad" style="padding-top:6px" data-wait-body></div>
            </div>`;

        const body = $('[data-wait-body]', container);

        const draw = (needle = '') => {
            const text = needle.trim().toLowerCase();
            const rows = entries.filter(entry => !text
                || (entry.patientName || '').toLowerCase().includes(text)
                || (entry.doctorName || '').toLowerCase().includes(text));

            if (!rows.length) {
                body.innerHTML = `<div class="empty"><span class="big">${lucide('list-ordered', 'ico-30')}</span>
                    ${text ? 'No place on the list matches that search.'
                        : isPatient()
                            ? 'You are not on any waiting list.<br>Open <strong>Book an appointment</strong>, choose a doctor — if no time suits you, you can join their waiting list from there.'
                            : 'Nobody is waiting at the moment.'}</div>`;
                drawIcons(body);
                return;
            }

            if (isPatient()) {
                body.innerHTML = `<div class="wait-cards">` + rows.map(entry => `
                    <div class="wait-card">
                        <div class="wc-top">
                            ${personCell(entry.doctorPhoto, 'Dr. ' + entry.doctorName, entry.specialization)}
                            ${stateBadge(entry)}
                        </div>
                        <div class="wc-grid">
                            <div><span class="cell-sub">Can come</span><strong>${esc(entry.window)}</strong></div>
                            <div><span class="cell-sub">Place taken</span><strong>${esc(entry.createdStamp)}</strong></div>
                            ${entry.offeredTime ? `<div><span class="cell-sub">Time offered</span>
                                <strong class="offer-time">${esc(entry.offeredTime)}</strong></div>` : ''}
                        </div>
                        ${entry.note ? `<div class="wc-note">“${esc(entry.note)}”</div>` : ''}
                        <div class="wc-actions">
                            ${entry.status === 'OFFERED' && entry.offeredSlotId
                                ? `<button class="btn btn-primary btn-sm" data-book="${entry.offeredSlotId}"
                                        data-doctor="${entry.doctorId}">${lucide('calendar-plus', 'ico-15')}
                                        Book this time</button>` : ''}
                            ${entry.open
                                ? `<button class="btn btn-sm" data-leave="${entry.id}">Leave the waiting list</button>`
                                : ''}
                        </div>
                    </div>`).join('') + `</div>`;
            } else {
                body.innerHTML = tableBlock([
                    { label: 'Patient', cell: entry => personCell(entry.patientPhoto, entry.patientName,
                            entry.patientPhone || '') },
                    { label: 'Waiting for', cell: entry => `<span class="cell-strong">Dr. ${esc(entry.doctorName)}</span>
                            <span class="cell-sub">${esc(entry.specialization || '')}</span>` },
                    { label: 'Can come', cell: entry => esc(entry.window)
                            + (entry.offeredTime ? `<span class="cell-sub offer-time">Offered: ${esc(entry.offeredTime)}</span>` : '') },
                    { label: 'Where it stands', cell: entry => stateBadge(entry)
                            + `<span class="cell-sub">joined ${esc(entry.createdStamp)}</span>`
                            + (entry.note ? `<span class="cell-sub">“${esc(entry.note)}”</span>` : '') },
                    { label: '', cell: entry => `<div class="flex" style="gap:6px; justify-content:flex-end">
                            ${entry.open ? `<button class="btn btn-sm btn-primary" data-offer="${entry.id}">
                                    ${lucide('send', 'ico-15')} Offer a free time</button>` : ''}
                            ${entry.status === 'OFFERED' ? `<button class="btn btn-sm" data-already="${entry.id}">
                                    ${lucide('check', 'ico-15')} Booked</button>` : ''}
                            ${entry.open ? `<button class="btn btn-sm" data-drop="${entry.id}"
                                    title="Take this patient off the list">${lucide('x', 'ico-15')}</button>` : ''}
                        </div>` }
                ], rows, 'Nobody is waiting at the moment.');
            }
            drawIcons(body);
            wire(rows);
        };

        /** Everything a row can do. */
        function wire(rows) {
            $$('[data-leave]', body).forEach(button => button.onclick = () => {
                confirmDialog({
                    title: 'Leave the waiting list?',
                    message: 'Your place is given to the next patient. You can join again at any time.',
                    confirmLabel: 'Leave the list',
                    onConfirm: () => act(`/waitlist/${button.dataset.leave}/leave`, 'POST',
                            (answer) => toast(answer.message || 'You have been taken off the waiting list'))
                });
            });

            $$('[data-drop]', body).forEach(button => button.onclick = () => {
                confirmDialog({
                    title: 'Take this patient off the waiting list?',
                    message: 'Use this when the patient has told the clinic they no longer need a time.',
                    confirmLabel: 'Take off the list',
                    onConfirm: () => act(`/waitlist/${button.dataset.drop}`, 'DELETE',
                            (answer) => toast(answer.message || 'Removed from the waiting list', 'warn'))
                });
            });

            $$('[data-already]', body).forEach(button => button.onclick = () =>
                act(`/waitlist/${button.dataset.already}/booked`, 'POST',
                    (answer) => toast(answer.message || 'This place on the waiting list is complete')));

            /* the clinic offers one of that doctor's own free times */
            $$('[data-offer]', body).forEach(button => button.onclick = () => {
                const row = rows.find(entry => String(entry.id) === String(button.dataset.offer)) || {};
                button.disabled = true;
                api(`/appointments/slots?doctorId=${row.doctorId}`).then((slotData) => {
                    button.disabled = false;
                    const slots = (slotData.slots || []).slice(0, 60);
                    if (!slots.length) {
                        toast('Dr. ' + row.doctorName + ' has no free times yet. Open more consulting hours '
                            + 'for them and the times will appear here.', 'warn');
                        return;
                    }
                    openOfferWindow({ row, slots });
                }).catch((error) => {
                    button.disabled = false;
                    fail(error);
                });
            });

            /* the patient takes up the time the clinic offered */
            $$('[data-book]', body).forEach(button => button.onclick = () =>
                go('appointmentNew', { doctorId: Number(button.dataset.doctor),
                                       slotId: Number(button.dataset.book) }));
        }

        /** One call, then the page draws itself again. */
        async function act(url, method, done) {
            try {
                const answer = await api(url, { method });
                done(answer || {});
                renderWaitlist(container, params);
            } catch (error) { fail(error); }
        }

        /** The list of free times the clinic may offer. */
        function openOfferWindow({ row, slots }) {
            modal({
                title: 'Offer a free time to ' + row.patientName,
                subtitle: 'Dr. ' + row.doctorName + ' · ' + row.window,
                body: `<div class="slot-pick">` + slots.map(slot => `
                        <button class="slot-btn" type="button" data-slot="${slot.id}"
                                data-label="${esc(fmtDate(slot.date))} at ${esc(slot.startTime)}">
                            <strong>${esc(slot.timeLabel)}</strong>
                            <span class="cell-sub">${esc(fmtDate(slot.date))}</span>
                        </button>`).join('') + `</div>`,
                footer: `<button class="btn" data-act="cancel">Close</button>`,
                onMount: (backdrop, close) => {
                    drawIcons(backdrop);
                    backdrop.querySelector('[data-act="cancel"]').onclick = close;
                    backdrop.querySelectorAll('[data-slot]').forEach(choice => choice.onclick = async () => {
                        try {
                            const answer = await api(`/waitlist/${row.id}/offer`, {
                                method: 'POST',
                                body: { slotId: Number(choice.dataset.slot), timeLabel: choice.dataset.label }
                            });
                            close();
                            toast(answer.message || 'The time has been offered');
                            renderWaitlist(container, params);
                        } catch (error) { fail(error); }
                    });
                }
            });
        }

        bindSearch(container, { id: 'waitSearch', onSearch: (text) => draw(text), shortcut: false });
        const toggle = $('[data-show]', container);
        if (toggle) toggle.onclick = () => go('waitlist', { show: toggle.dataset.show });
        draw('');
        body.querySelectorAll('.wait-card, .tc-card').forEach((row, index) => {
            row.classList.add('wait-enter');
            row.style.animationDelay = Math.min(index, 8) * 34 + 'ms';
        });
    }

    return { renderWaitlist, waitingListInvite };
}
