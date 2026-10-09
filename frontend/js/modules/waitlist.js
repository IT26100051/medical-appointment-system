/* =============================================================================
   MedCare - joining the waiting list (the small piece of the booking desk)
   =============================================================================
   Used in two places:

     * the booking desk - when a doctor has no free time in the next three
       weeks, the patient is invited to take a place on that doctor's list;
     * the waiting list page - the same window is opened from a row.

   The work itself is done by the server (POST /api/waitlist).  This file only
   talks to the person in front of the screen.
   ========================================================================== */

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* The icons used here are drawn by the bundle; if it is missing the words
   simply stand on their own. */
function icon(name, size, drawIcons) {
    if (typeof drawIcons !== 'function') {
        return '';
    }
    return `<i data-lucide="${name}" class="ico-${size}"></i>`;
}

/** The invitation card shown when a doctor has no free times. */
export function waitingListInvite(doctor, options = {}) {
    const escape = options.escape || escapeHtml;
    const name = 'Dr. ' + escape(doctor.fullName || 'this doctor');
    return `<div class="book-wait" data-bk="wait-invite">
        <span class="bw-ico">${icon('list-ordered', 22, options.drawIcons)}</span>
        <div class="bw-text">
            <strong>No free time with ${name}?</strong>
            <span>Take a place on their waiting list — the next time that frees up is
                offered to you first.</span>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-bk="wait-join">
            Join the waiting list</button>
    </div>`;
}

/**
 * The window in which a patient says when they can come.
 *
 * @param {object} options { doctor, api, toast, modal, drawIcons, escape, me, onDone }
 */
export function openJoinWaitlist(options) {
    const { doctor, api, toast, modal, drawIcons } = options;
    const escape = options.escape || escapeHtml;
    const today = new Date();
    const iso = (when) => new Date(when.getTime() - when.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);

    modal({
        title: 'Join the waiting list',
        subtitle: 'Dr. ' + doctor.fullName + ' · ' + (doctor.specialization || 'consulting'),
        body: `
            <div class="wait-form">
                <p class="wait-lead">Tell us when you could come. The clinic will offer you the
                    first free time that matches, and you decide whether to take it.</p>
                <div class="form-row">
                    <div class="field">
                        <label for="waitFrom">I can come from</label>
                        <input id="waitFrom" type="date" value="${iso(tomorrow)}" min="${iso(today)}">
                    </div>
                    <div class="field">
                        <label for="waitTo">Until (optional)</label>
                        <input id="waitTo" type="date" placeholder="Any time">
                    </div>
                </div>
                <div class="field">
                    <label for="waitNote">Anything the clinic should know (optional)</label>
                    <textarea id="waitNote" rows="2" maxlength="200"
                        placeholder="e.g. I can only come in the morning, or after 4 pm"></textarea>
                </div>
                <div class="wait-hint">${icon('info', 14, drawIcons)}
                    Your place moves up the list as earlier patients are seen.</div>
            </div>`,
        footer: `<button class="btn" data-act="cancel">Cancel</button>
                 <button class="btn btn-primary" data-act="join">Take my place on the list</button>`,
        onMount: (root, close) => {
            if (typeof drawIcons === 'function') {
                drawIcons(root);
            }
            const from = root.querySelector('#waitFrom');
            const to = root.querySelector('#waitTo');
            const note = root.querySelector('#waitNote');
            root.querySelector('[data-act="cancel"]').onclick = close;
            root.querySelector('[data-act="join"]').onclick = async (event) => {
                const button = event.currentTarget;
                if (button.disabled) {
                    return;
                }
                button.disabled = true;
                button.textContent = 'Adding your place…';
                try {
                    const answer = await api('/waitlist', {
                        method: 'POST',
                        body: {
                            doctorId: doctor.id,
                            preferredFrom: from.value || null,
                            preferredTo: to.value || null,
                            note: (note.value || '').trim() || null
                        }
                    });
                    close();
                    toast((answer && answer.message)
                        || 'You are on the waiting list - we will tell you the moment a time frees up');
                    if (typeof options.onDone === 'function') {
                        options.onDone(answer);
                    }
                } catch (error) {
                    button.disabled = false;
                    button.textContent = 'Take my place on the list';
                    if (typeof options.fail === 'function') {
                        options.fail(error);
                    } else {
                        toast(error.message || 'The waiting list could not be reached', 'error');
                    }
                }
            };
        }
    });
}
