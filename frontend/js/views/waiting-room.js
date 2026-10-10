/* =============================================================================
   MedCare - the waiting room page
   =============================================================================
   The day's queue with a token number for every patient. The board itself lives
   in js/modules/queue.js; this page fetches the clinic's answer, hands it over
   and places the board on screen.

   The page is a factory: the portal hands in its helpers when it starts
   (see js/app.js) and gets the page's entry points back.
   ========================================================================== */

export function waitingRoomView(deps) {
    const { MedCare, api, avatarHtml, drawIcons, esc, go, lucide, personCell, priorityPill,
            statusBadge, toast } = deps;
    const links = deps.links || {};
    const { openAppointmentDetail, completeAppointment } = links;

async function renderWaitingRoom(container, params = {}) {
    const queue = MedCare.queue || null;
    const date = params.date || '';
    const doctorId = (deps.me.role === 'DOCTOR') ? String(deps.me.id) : (params.doctorId || '');
    const query = [date ? 'date=' + encodeURIComponent(date) : '',
                   doctorId ? 'doctorId=' + encodeURIComponent(doctorId) : '']
        .filter(Boolean).join('&');

    const [board, doctors] = await Promise.all([
        api('/queue' + (query ? '?' + query : '')),
        deps.me.role === 'DOCTOR' ? Promise.resolve({ doctors: [] }) : api('/doctors?activeOnly=true')
    ]);

    if (!queue || typeof queue.queueBoardHtml !== 'function') {
        container.innerHTML = `<div class="card card-pad"><div class="empty">
            <span class="big">${lucide('hourglass', 'ico-32')}</span>
            The waiting room board could not be shown on this device.</div></div>`;
        return;
    }

    const options = {
        canManage: true,
        doctors: (doctors.doctors || []).map(d => ({ id: d.id, fullName: d.fullName })),
        doctorId: board.doctorId || doctorId,
        date: board.date || date,
        onOpen: (id) => openAppointmentDetail(id, () => go('waitingRoom', params)),
        onSeen: (id) => {
            const record = (board.waiting || []).find(row => String(row.appointmentId) === String(id)) || {};
            completeAppointment(id, () => go('waitingRoom', params), {
                patientName: record.patientName,
                doctorName: record.doctorName,
                referenceNo: record.referenceNo
            });
        },
        confirm: (title, text) => window.confirm(title + '\n\n' + text),
        onChange: (choice) => go('waitingRoom', { date: choice.date, doctorId: choice.doctorId })
    };

    container.innerHTML = queue.queueBoardHtml(board, {
        escape: esc,
        avatar: avatarHtml,
        personCell,
        statusBadge,
        priorityPill,
        hourglass: lucide('hourglass', 'ico-16')
    }, options);
    drawIcons(container);
    queue.bindQueueBoard({ api, toast }, container, options);
}

    return { renderWaitingRoom };
}
