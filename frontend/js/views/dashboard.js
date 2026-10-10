/* =============================================================================
   MedCare - The dashboard page
   =============================================================================
   The first page everybody sees: the clinic counters, the next visit, the
   activity feed and the day chart.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back, so this file can be
   read on its own. It was moved here from js/app.js unchanged.
   ========================================================================== */

export function dashboardView(deps) {
    const { EASE, MedCare, anim, animateCounters, api, avatarHtml, canStagger, drawIcons, esc, fail, fmtDate, fmtDateTime, fmtRelative, fmtTime, go, lucide, personCell, relativeChip, statusBadge, tableBlock, toast, visit, $, $$, priorityPill, countdownText } = deps;
    const links = deps.links || {};
    const { quickBook, completeAppointment, cancelAppointment, openAppointmentDetail } = links;

/* =====================================================================
   DASHBOARD
   ================================================================== */
/** Good morning / afternoon / evening - a very small human touch. */
function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

async function renderDashboard(container) {
    const data = await api('/dashboard');
    const s = data.stats || {};
    const isPatient = deps.me.role === 'PATIENT';
    const isDoctor = deps.me.role === 'DOCTOR';

    let cards = '';
    if (isPatient) {
        cards = [
            ['Upcoming appointments', s.myUpcoming, 'Pending or confirmed', 'calendar-clock'],
            ['Completed visits', s.myCompleted, 'History of your consultations', 'circle-check'],
            ['Cancelled so far', s.myCancelled, 'Kept as your history', 'calendar-x'],
            ['Unread notifications', s.unreadNotifications, 'Appointment updates', 'bell']
        ];
    } else if (isDoctor) {
        cards = [
            ['Upcoming appointments', s.myUpcoming, 'Your scheduled patients', 'calendar-clock'],
            ['Patients treated', s.myPatients, 'Distinct patients on record', 'users'],
            ['Open slots', s.mySlots, 'Available for booking', 'clock'],
            ['Average rating', s.myRating === null || s.myRating === undefined ? '—' : s.myRating + ' / 5', 'From patient feedback', 'star'],
            ['Waiting for a free time', s.myWaitingList, 'Patients on your waiting list', 'list-ordered']
        ];
    } else {
        cards = [
            ['Registered patients', s.patients, (s.activePatients ? s.activePatients + ' active' : ''), 'users'],
            ['Doctors', s.doctors, (s.activeDoctors ? s.activeDoctors + ' active' : 'All specialities'), 'stethoscope'],
            ["Today's appointments", s.appointmentsToday, s.appointmentsTotal + ' appointments in total', 'calendar-days'],
            ['Available times', s.availableSlots, 'Open for booking', 'clock'],
            ['Waiting at the desk', s.pending, 'Still to be confirmed', 'hourglass'],
            ['Cancelled (kept as history)', s.cancelled, 'Retained records', 'calendar-x'],
            ['Waiting for a free time', s.waitingList, 'Patients on a waiting list', 'list-ordered'],
            ['Patient feedback', s.feedbackCount, s.averageRating ? 'Average ' + s.averageRating + ' / 5' : 'No ratings yet', 'message-square-heart'],
            ['Staff accounts', s.staffAccounts, 'Administrators & receptionists', 'shield-check']
        ];
    }

    container.innerHTML = `
        <div class="card card-pad hero-panel" style="position:relative; overflow:hidden">
            <div class="flex flex-wrap">
                <div>
                    <div style="font-size:12.5px; text-transform:uppercase; letter-spacing:.14em; opacity:.75">
                        ${esc(deps.me.role)} workspace</div>
                    <div class="flex" style="gap:12px; align-items:center; margin-top:6px">
                        ${avatarHtml(deps.me.photo, deps.me.fullName, 48)}
                        <div style="font-size:24px; font-weight:700">${greeting()}, ${esc(deps.me.fullName)}</div>
                    </div>
                    <div style="opacity:.85; margin-top:4px" class="small">
                        ${isPatient ? 'Book appointments, review your visits and send feedback to your doctors.'
                          : isDoctor ? 'Review your schedule, confirm appointments and read patient feedback.'
                          : 'Manage patients, doctors, appointments and availability from one place.'}
                    </div>
                </div>
                <div class="spacer"></div>
                <div class="flex flex-wrap">
                    ${isPatient ? `<button class="btn btn-primary" id="quickBook">${lucide('calendar-plus', 'ico-16')} Book appointment</button>
                                   <button class="btn" id="quickFeedback">${lucide('star', 'ico-16')} Give feedback</button>` : ''}
                    ${isDoctor ? `<button class="btn btn-primary" id="quickSchedule">${lucide('clock', 'ico-16')} Add availability</button>` : ''}
                    ${deps.me.role === 'ADMIN' || deps.me.role === 'RECEPTIONIST'
                        ? `<button class="btn btn-primary" id="quickBook">${lucide('calendar-plus', 'ico-16')} Book appointment</button>
                           <button class="btn" id="quickPatient">${lucide('user-plus', 'ico-16')} Register patient</button>` : ''}
                </div>
            </div>
        </div>

        ${nextVisitCard(data.upcoming || [])}

        ${waitingNotice(s, isPatient, isDoctor)}

        ${isPatient ? '<div id="myPlace" class="mt-16"></div>' : ''}

        <div class="grid cols-4 mt-16">
            ${cards.map(([label, value, foot, icon]) => `
                <div class="stat"><div class="glow"></div>
                    <div class="flex"><span class="stat-ico">${lucide(icon)}</span>
                    <span class="label">${esc(label)}</span></div>
                    <div class="value">${value === undefined || value === null ? '0' : esc(value)}</div>
                    <div class="foot">${esc(foot || '')}</div>
                </div>`).join('')}
        </div>

        ${isPatient ? '' : activityCard(data.activity || [])}

        <div class="grid cols-2 mt-24">
            <div class="card">
                <div class="card-head"><h3>Upcoming appointments</h3>
                    <span class="sub">Next confirmed & pending visits</span>
                    <div class="right"><button class="btn btn-sm" id="allAppointments">View all</button></div>
                </div>
                ${tableBlock([
                    { label: 'Reference', cell: a => `<span class="mono">${esc(a.referenceNo)}</span>` },
                    { label: isPatient ? 'Doctor' : 'Patient', cell: a => personCell(isPatient ? a.doctorPhoto : a.patientPhoto, isPatient ? a.doctorName : a.patientName, isPatient ? (a.specialization || '') : a.doctorName) },
                    { label: 'When', cell: a => `${fmtDate(a.date)} ${relativeChip(a.date, a.upcoming)}<span class="cell-sub">${fmtTime(a.startTime)}</span>` },
                    { label: 'Status', cell: a => statusBadge(a.status, a.statusLabel) },
                    { label: '', right: true, cell: a => `<div class="row-actions">
                            ${!isPatient && a.status === 'PENDING' ? `<button class="btn btn-sm btn-primary" data-dconfirm="${a.id}" title="Confirm this appointment">${lucide('check', 'ico-16')}</button>` : ''}
                            ${!isPatient ? `<button class="btn btn-sm" data-dcomplete="${a.id}" title="Finish this consultation">${lucide('check-check', 'ico-16')}</button>` : ''}
                            ${isPatient ? `<button class="btn btn-sm btn-danger" data-dcancel="${a.id}" title="Cancel this appointment">${lucide('calendar-x', 'ico-16')}</button>` : ''}
                            <button class="btn btn-sm" data-dmanage="${a.id}" title="Open the appointment">Manage</button>
                        </div>` }
                ], data.upcoming || [], 'No upcoming appointments')}
            </div>

            <div class="card">
                <div class="card-head"><h3>Recent notifications</h3>
                    <div class="right"><button class="btn btn-sm" id="allNotifications">Open inbox</button></div>
                </div>
                <div>
                    ${(data.notifications || []).length === 0
                        ? `<div class="empty"><span class="big">${lucide('bell', 'ico-32')}</span>Nothing new right now</div>`
                        : data.notifications.map(n => `
                            <div class="notif-item unread">
                                <span class="notif-dot"></span>
                                <div>
                                    <div class="n-title">${esc(n.title)}</div>
                                    <div class="n-msg">${esc(n.message)}</div>
                                    <div class="n-meta" title="${esc(fmtDateTime(n.createdAt))}">${esc(n.typeLabel)} · ${esc(fmtRelative(n.createdAt) || fmtDateTime(n.createdAt))}</div>
                                </div>
                            </div>`).join('')}
                </div>
            </div>
        </div>`;

    const bindQuick = (id, view) => { const node = $('#' + id); if (node) node.onclick = () => go(view); };
    bindQuick('quickBook', 'appointmentNew');
    bindQuick('waitOpen', 'waitlist');
    bindQuick('nvBook', 'appointmentNew');
    bindQuick('quickPatient', 'patientNew');
    bindQuick('quickFeedback', 'feedbackNew');
    bindQuick('quickSchedule', 'scheduleNew');
    $('#allAppointments').onclick = () => go('appointments');
    $('#allNotifications').onclick = () => go('notifications');

    /* The patient's place in line, the way a hospital token slip works. */
    const place = $('#myPlace', container);
    if (place) {
        const queue = MedCare.queue;
        api('/queue/my-place').then(answer => {
            if (!answer.hasAppointment) return;                  // nothing to say
            place.innerHTML = `<div class="card card-pad">
                <div class="card-head" style="padding:0 0 10px"><h3>Your place in line</h3>
                    <span class="sub">Tokens are called in this order at the clinic</span>
                    <div class="right"><button class="btn btn-sm" id="placeSee">${lucide('ticket', 'ico-16')} Check-in pass</button></div>
                </div>
                ${queue && typeof queue.myPlaceHtml === 'function'
                    ? queue.myPlaceHtml(answer, { escape: esc })
                    : `<p class="muted small" style="margin:0">${esc(answer.note || '')}</p>`}
            </div>`;
            drawIcons(place);
            const see = $('#placeSee', place);
            if (see) see.onclick = () => openAppointmentDetail(answer.appointmentId, () => go('dashboard'));
        }).catch(() => { /* the place in line is a bonus; never break the dashboard for it */ });
    }

    $$('[data-dmanage]', container).forEach(b => b.onclick = () => openAppointmentDetail(b.dataset.dmanage, () => go('dashboard')));
    $$('[data-checkin]', container).forEach(b => b.onclick = () => openAppointmentDetail(b.dataset.checkin, () => go('dashboard')));
    $$('[data-dconfirm]', container).forEach(b => b.onclick = async () => {
        try { const r = await api(`/appointments/${b.dataset.dconfirm}/confirm`, { method: 'POST' }); toast(r.message); go('dashboard'); }
        catch (e) { fail(e); }
    });
    $$('[data-dcomplete]', container).forEach(b => b.onclick = () => completeAppointment(b.dataset.dcomplete, () => go('dashboard')));
    $$('[data-dcancel]', container).forEach(b => b.onclick = () => cancelAppointment(b.dataset.dcancel, null, () => go('dashboard')));

    animateCounters(container);
    drawActivity(container, data.activity || []);
}

/* =====================================================================
   The two-week consultation chart on the dashboard.  It is drawn from the
   same appointment records the clinic works with every day.
   ================================================================== */
function activityCard(activity) {
    if (!activity.length) return '';
    const booked = activity.reduce((total, day) => total + (day.count || 0), 0);
    return `
        <div class="card mt-24" id="activityCard">
            <div class="card-head">
                <h3>Consultations over the last two weeks</h3>
                <span class="sub">Every appointment booked into the clinic each day</span>
                <div class="right"><span class="pill">${booked} in this period</span></div>
            </div>
            <div class="card-pad">
                <svg class="chart" viewBox="0 0 640 132" preserveAspectRatio="none" role="img"
                     aria-label="Appointments recorded each day over the last two weeks">
                    <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#5DAE4F" stop-opacity=".34"/>
                            <stop offset="100%" stop-color="#2C8078" stop-opacity=".02"/>
                        </linearGradient>
                        <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#5DAE4F"/>
                            <stop offset="100%" stop-color="#2C8078"/>
                        </linearGradient>
                    </defs>
                    <g id="chartGrid"></g>
                    <path class="area" id="chartArea" d=""></path>
                    <path class="line" id="chartLine" d=""></path>
                    <g id="chartDots"></g>
                </svg>
                <div class="chart-legend" id="chartLegend"></div>
            </div>
        </div>`;
}

function drawActivity(container, activity) {
    const line = $('#chartLine', container);
    if (!line || !activity.length) return;
    const W = 640, H = 132, padX = 8, padY = 16;
    const peak = Math.max(1, ...activity.map(day => day.count || 0));
    const stepX = (W - padX * 2) / Math.max(1, activity.length - 1);
    const points = activity.map((day, index) => [
        padX + index * stepX,
        H - padY - ((day.count || 0) / peak) * (H - padY * 2),
        day
    ]);
    const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    $('#chartArea', container).setAttribute('d',
        `${path} L${points[points.length - 1][0].toFixed(1)},${H} L${points[0][0].toFixed(1)},${H} Z`);
    line.setAttribute('d', path);
    $('#chartGrid', container).innerHTML = [0, .5, 1].map(fraction => {
        const y = (padY + fraction * (H - padY * 2)).toFixed(1);
        return `<line class="grid-line" x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    }).join('');
    $('#chartDots', container).innerHTML = points.map(([x, y, day], index) => {
        const last = index === points.length - 1;
        return `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${last ? 4.6 : 3.2}">
                    <title>${esc(day.label)}: ${day.count} appointment${day.count === 1 ? '' : 's'}</title>
                </circle>`;
    }).join('');
    const legend = $('#chartLegend', container);
    if (legend) {
        legend.innerHTML = activity.map(day =>
            `<span${day === activity[activity.length - 1] ? ' style="font-weight:700;color:var(--teal)"' : ''}>${esc(day.weekday || day.label)}</span>`
        ).join('');
    }
    try {
        const length = line.getTotalLength();
        line.style.strokeDasharray = length;
        line.style.strokeDashoffset = length;
        anim(line, { strokeDashoffset: [length, 0] }, { duration: 1.15, ease: EASE });
    } catch (error) { /* the line is simply visible straight away */ }
    anim($$('#chartDots .dot', container), { opacity: [0, 1], scale: [.4, 1] },
        { duration: .4, ease: EASE, delay: canStagger ? MedCare.stagger(.045) : 0 });
    attachChartTips(container);
}

/** Hovering a day on the chart shows what happened that day. */
function attachChartTips(container) {
    const floating = MedCare.floating;
    const chart = $('.chart', container);
    if (!chart || !floating || typeof floating.computePosition !== 'function') return;
    let tip = $('#chartTip', container);
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'chartTip';
        tip.className = 'chart-tip';
        chart.parentNode.appendChild(tip);
    }
    const hide = () => tip.classList.remove('on');
    const show = (dot, text) => {
        tip.innerHTML = text;
        tip.classList.add('on');
        floating.computePosition(dot, tip, {
            placement: 'top',
            middleware: [floating.offset(12), floating.flip({ padding: 8 }), floating.shift({ padding: 8 })]
        }).then(({ x, y }) => {
            tip.style.left = x + 'px';
            tip.style.top = y + 'px';
        }).catch(() => { /* the tooltip stays where it was */ });
    };
    $$('.chart .dot', container).forEach(dot => {
        const title = dot.querySelector('title');
        const text = title ? title.textContent : '';
        dot.addEventListener('mouseenter', () => show(dot, esc(text.replace(':', ' —'))));
        dot.addEventListener('mouseleave', hide);
        dot.style.cursor = 'pointer';
    });
    chart.addEventListener('mouseleave', hide);
}

/**
 * The card every patient looks for first: the next visit, with the doctor's
 * photograph, the time and the buttons that apply to it.
 */
/**
 * The waiting list, said in one line: a patient is reminded of a time that has
 * opened up for them, and the clinic team is offered a shortcut to the list.
 */
function waitingNotice(s, isPatient, isDoctor) {
    if (isPatient) {
        if (s.myOfferedPlace) {
            return `<div class="card card-pad wait-notice is-live mt-16">
                <span class="wn-ico">${lucide('bell-ring', 'ico-24')}</span>
                <div class="wn-text">
                    <strong>A time has opened up for you</strong>
                    <span>${esc(s.myOfferedPlace)}. If it suits you, book it before it is offered to somebody else.</span>
                </div>
                <button class="btn btn-primary" id="waitOpen">See my places</button>
            </div>`;
        }
        if (s.myWaitingPlaces > 0) {
            return `<div class="card card-pad wait-notice mt-16">
                <span class="wn-ico calm">${lucide('list-ordered', 'ico-24')}</span>
                <div class="wn-text">
                    <strong>You are on a waiting list</strong>
                    <span>The clinic will tell you as soon as a time frees up.</span>
                </div>
                <button class="btn btn-sm" id="waitOpen">See my places</button>
            </div>`;
        }
        return '';
    }
    const waiting = isDoctor ? s.myWaitingList : s.waitingList;
    if (!waiting) {
        return '';
    }
    return `<div class="card card-pad wait-notice mt-16">
        <span class="wn-ico calm">${lucide('list-ordered', 'ico-24')}</span>
        <div class="wn-text">
            <strong>${waiting} ${waiting === 1 ? 'patient is' : 'patients are'} waiting for a free time</strong>
            <span>${isDoctor
                ? 'The first free time that fits them is offered automatically when somebody cancels.'
                : 'Offer a free time, or let the clinic do it the moment an appointment is cancelled.'}</span>
        </div>
        <button class="btn btn-sm" id="waitOpen">Open the waiting list</button>
    </div>`;
}

function nextVisitCard(upcoming) {
    const next = upcoming.find(a => a.status === 'CONFIRMED' || a.status === 'PENDING');
    if (!next) {
        return `<div class="card card-pad mt-16 next-visit empty">
            <div class="nv-icon">${lucide('calendar-check', 'ico-20')}</div>
            <div>
                <div class="nv-label">Next appointment</div>
                <div class="nv-title">Nothing booked yet</div>
                <div class="small muted">Book a visit and it will appear here with all the details.</div>
            </div>
            <div class="spacer"></div>
            ${deps.me.role === 'PATIENT' ? '<button class="btn btn-primary" id="nvBook">' + lucide('calendar-plus', 'ico-16') + ' Book an appointment</button>' : ''}
        </div>`;
    }
    const isPatient = deps.me.role === 'PATIENT';
    const person = isPatient
        ? { photo: next.doctorPhoto, name: next.doctorName, role: next.specialization }
        : { photo: next.patientPhoto, name: next.patientName, role: next.patientPhone };
    const away = Number(next.daysAway);
    const soon = Number.isFinite(away) && away <= 1;
    return `<div class="card card-pad mt-16 next-visit">
        <div class="nv-photo">${avatarHtml(person.photo, person.name, 68)}</div>
        <div>
            <div class="nv-label">Your next appointment</div>
            <div class="nv-title">${esc(person.name)}</div>
            <div class="small muted">${esc(person.role || '')}</div>
            <div class="mt-8">${priorityPill(next.priorityLabel, next.priority)}</div>
        </div>
        <div class="nv-when">
            <div class="nv-label">When</div>
            <div class="nv-title">${fmtDate(next.date)}
                <span class="countdown-chip${soon ? ' is-soon' : ''}">${esc(countdownText(next.daysAway))}</span></div>
            <div class="small muted">at ${fmtTime(next.startTime)}</div>
        </div>
        <div class="nv-when">
            <div class="nv-label">Where</div>
            <div class="nv-title">${esc(next.specialization || 'Consultation')}</div>
            <div class="small muted">${esc(next.referenceNo)}</div>
        </div>
        <div class="spacer"></div>
        <div class="row-actions">
            ${statusBadge(next.status, next.statusLabel)}
            <button class="btn" data-checkin="${next.id}" title="Show the check-in pass">${lucide('scan-line', 'ico-16')} Check-in pass</button>
            <button class="btn" data-dmanage="${next.id}">View details</button>
        </div>
    </div>`;
}

    return { renderDashboard, greeting, activityCard, drawActivity, attachChartTips };
}
