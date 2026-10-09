/* =============================================================================
   The waiting list, checked end to end
   -----------------------------------------------------------------------------
   The rule the clinic works by: when a patient cannot find a suitable time they
   take a place on the doctor's waiting list; when a time is freed it is offered
   to the patient who has waited longest - as long as that day suits them.

   What this file proves:
     1. the page, the menu entry and the text file are all wired in
     2. a patient joins the list and only ever sees and closes their own places
     3. the clinic may offer one of the doctor's own free times
     4. a cancelled appointment is offered to the person waiting longest
     5. a freed time that does not suit the patient is NOT offered to them
     6. booking closes the patient's own place on that doctor's list
     7. the page itself renders for both the patient and the clinic
     8. the work appears in waiting-list.txt and in the clinic summary

   Run:  node tools/ui-checks/waitlist.js                     (full, changes data)
         node tools/ui-checks/waitlist.js --read-only         (changes nothing)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const PROJECT = '/home/user/medical-appointment-system';
const ROOT = path.join(PROJECT, 'frontend');
const BACKEND = path.join(PROJECT, 'backend/src/main/java/com/medcare');
const BASE = process.env.CLINIC || 'http://localhost:8080';
const DOCS = process.env.CLINIC_DOCS || path.join(PROJECT, 'documents');
const READ_ONLY = process.argv.includes('--read-only');
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Waits until the page really has what we are looking for (a busy server answers slowly). */
async function until(condition, label, timeout = 15000) {
    const started = Date.now();
    for (;;) {
        try { if (condition()) return true; } catch (error) { /* keep waiting */ }
        if (Date.now() - started > timeout) return false;
        await wait(350);
    }
}

let pass = 0, fail = 0;
const problems = [];
function check(ok, label, detail) {
    if (ok) { pass++; console.log('  ✅ ' + label + (detail ? ' — ' + detail : '')); }
    else { fail++; problems.push(label + (detail ? ' — ' + detail : '')); console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

async function session(username, password) {
    const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('sign-in failed for ' + username + ' (' + res.status + ')');
    return (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')])
        .filter(Boolean).map(c => c.split(';')[0]).join('; ');
}

async function call(cookie, url, options = {}) {
    const config = { headers: { Cookie: cookie, ...(options.headers || {}) }, ...options };
    if (config.body && typeof config.body !== 'string') {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(config.body);
    }
    const res = await fetch(BASE + '/api' + url, config);
    let body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    return { status: res.status, body };
}

/** A page of the portal, loaded the way the browser loads it. */
function page(html, cookie) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message)));
    const dom = new JSDOM(html, { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const w = dom.window;
    w.matchMedia = q => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
    w.cancelAnimationFrame = id => clearTimeout(id);
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
    w.fetch = async (url, options = {}) => {
        const res = await fetch(url.startsWith('http') ? url : BASE + url,
            { ...options, headers: { ...(options.headers || {}), Cookie: cookie } });
        const text = await res.text();
        return { ok: res.ok, status: res.status, headers: { get: n => res.headers.get(n) },
            json: async () => JSON.parse(text), text: async () => text };
    };
    w.eval(fs.readFileSync(path.join(ROOT, 'js/vendor.js'), 'utf8'));
    w.eval(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8') + ';window.__App = App;');
    w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
    w.__errors = errors;
    return w;
}

(async () => {
    console.log('\nTHE WAITING LIST');
    console.log('  clinic: ' + BASE + (READ_ONLY ? '   (read-only run)' : ''));

    /* ------------------------------------------------------------- 1. wired in */
    console.log('\n1. the piece is wired into the whole application');
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    const entry = fs.readFileSync(path.join(ROOT, 'js/vendor.entry.js'), 'utf8');
    check(fs.existsSync(path.join(ROOT, 'js/views/waitlist.js')), 'the page has a file of its own (js/views/waitlist.js)');
    check(fs.existsSync(path.join(ROOT, 'js/modules/waitlist.js')), 'and joining the list has one too (js/modules/waitlist.js)');
    check(/import \{ waitlistView \}/.test(entry) && /waitlist: waitlistView/.test(entry), 'the bundle carries the page');
    check(/\{ id: 'waitlist', label: 'Waiting list'[^}]*roles: \['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'\]/.test(app),
        'every signed-in person has the menu entry');
    check(/waitlist: \(container, params\) => views\.waitlist\.renderWaitlist/.test(app), 'and the address opens it');

    const outputFile = fs.readFileSync(path.join(BACKEND, 'common/documents/OutputFile.java'), 'utf8');
    const exportService = fs.readFileSync(path.join(BACKEND, 'common/documents/DataExportService.java'), 'utf8');
    const appointmentService = fs.readFileSync(path.join(BACKEND, 'appointmentmanagement/AppointmentService.java'), 'utf8');
    check(/WAITLIST\("waiting-list\.txt", "Waiting List"/.test(outputFile), 'the waiting list has its own text file');
    check(/refreshWaitlist\(\)/.test(exportService) && /refreshWaitlist\(\);\n        refreshSummary/.test(exportService),
        'and it is written with all the other files');
    check(/Patients on the waiting list/.test(exportService), 'the clinic summary counts who is waiting');
    check(/waitlistService\.offerFreedSlot\(saved\)/.test(appointmentService), 'a cancellation hands the freed time to the waiting list');
    check(/waitlistService\.closePlacesFor\(saved\)/.test(appointmentService), 'and a booking closes the patient\'s own place');
    const entryFile = fs.readFileSync(path.join(BACKEND, 'appointmentmanagement/WaitlistEntry.java'), 'utf8');
    const service = fs.readFileSync(path.join(BACKEND, 'appointmentmanagement/WaitlistService.java'), 'utf8');
    check(/public boolean suits\(LocalDate day\)/.test(entryFile), 'the rule "does this day suit the patient" lives in the entry itself');
    check(/filter\(entry -> entry\.suits\(appointment\.getAppointmentDate\(\)\)\)/.test(service),
        'so a time nobody can attend is offered to nobody');

    /* ------------------------------------------------------ the live clinic --- */
    const admin = await session('admin', 'admin123');
    const patient = await session('nimasha', 'patient123');
    const doctor = await session('drsilva', 'doctor123');
    const someoneElse = await session('maleesha', 'patient123').catch(() => null);

    console.log('\n2. who may see what');
    const adminBoard = await call(admin, '/waitlist');
    const doctorBoard = await call(doctor, '/waitlist');
    const patientBoard = await call(patient, '/waitlist');
    check(adminBoard.status === 200 && doctorBoard.status === 200 && patientBoard.status === 200,
        'the administrator, a doctor and a patient may all open the list',
        [adminBoard.status, doctorBoard.status, patientBoard.status].join(' / '));
    check(Array.isArray(adminBoard.body.entries), 'the clinic sees the entries', adminBoard.body.entries.length + ' place(s)');
    const shapes = Object.keys(adminBoard.body.entries[0] || {});
    check(shapes.includes('statusLabel') && shapes.includes('window') && shapes.includes('patientPhoto'),
        'every place carries the patient, the doctor, the window and its state');
    check((doctorBoard.body.entries || []).every(row => String(row.doctorId) === '4'),
        'a doctor only sees their own waiting list', (doctorBoard.body.entries || []).length + ' place(s)');
    const ownOnly = (patientBoard.body.entries || []).every(row => String(row.patientId) === '8');
    check(ownOnly && (patientBoard.body.entries || []).length <= (adminBoard.body.entries || []).length,
        'a patient only sees their own places', (patientBoard.body.entries || []).length + ' place(s)');

    const staffDash = await call(admin, '/dashboard');
    const doctorDash = await call(doctor, '/dashboard');
    check(typeof (staffDash.body.stats || {}).waitingList === 'number',
        'the clinic dashboard counts who is waiting', 'waitingList = ' + (staffDash.body.stats || {}).waitingList);
    check(typeof (doctorDash.body.stats || {}).myWaitingList === 'number',
        'and a doctor sees how many wait for them', 'myWaitingList = ' + (doctorDash.body.stats || {}).myWaitingList);

    /* --------------------------------------------------- 3. the text file --- */
    console.log('\n3. the work reaches a text file');
    const docs = await call(admin, '/reports');
    const files = (docs.body.files || []).map(f => f.fileName);
    check(files.includes('waiting-list.txt'), 'the Documents page lists waiting-list.txt');
    const doc = await call(admin, '/reports/waiting-list.txt/content');
    check(doc.status === 200 && /MEDICAL APPOINTMENT SCHEDULING SYSTEM/.test(doc.body.content || ''),
        'and the file itself may be read', doc.status);
    check(/Waiting-list entry/.test(doc.body.content || ''), 'it holds one block per place on the list');
    const summary = await call(admin, '/reports/reports__clinic-summary.txt/content');
    check(/Patients on the waiting list/.test(summary.body.content || ''), 'the clinic summary counts them too');

    if (!READ_ONLY) {
        /* ------------------------------------------------------ 4. joining --- */
        console.log('\n4. a patient takes a place on the list');
        const doctors = await call(admin, '/doctors?activeOnly=true');
        const drNawaz = (doctors.body.doctors || []).find(d => d.id === 7);
        const mine = (patientBoard.body.entries || []).find(e => e.open && String(e.doctorId) === '7');
        if (mine) {                                   /* tidy up any earlier run */
            await call(patient, '/waitlist/' + mine.id, { method: 'DELETE' });
        }
        const joined = await call(patient, '/waitlist', { method: 'POST',
            body: { doctorId: 7, preferredFrom: '2026-10-10', note: 'Mornings please' } });
        check(joined.status === 200 && joined.body.entry && joined.body.entry.status === 'WAITING',
            'she is on Dr. ' + (drNawaz ? drNawaz.fullName : '7') + '\'s list', joined.body.entry && joined.body.entry.statusLabel);
        const again = await call(patient, '/waitlist', { method: 'POST',
            body: { doctorId: 7, preferredFrom: '2026-10-10' } });
        check(again.status >= 400 && /already/i.test(again.body.message || ''),
            'and cannot take the same place twice', again.body.message);
        const entryId = joined.body.entry.id;

        if (someoneElse) {
            const cross = await call(someoneElse, '/waitlist/' + entryId, { method: 'DELETE' });
            check(cross.status === 403, 'another patient may not close her place', 'answer ' + cross.status);
        }

        /* ------------------------------------------------------- 5. offering --- */
        console.log('\n5. the clinic offers a free time');
        const slots = await call(admin, '/appointments/slots?doctorId=7');
        const free = (slots.body.slots || [])[0];
        if (free) {
            const offered = await call(admin, '/waitlist/' + entryId + '/offer',
                { method: 'POST', body: { slotId: free.id, timeLabel: free.timeLabel } });
            check(offered.status === 200, 'the time was offered', offered.body.message);
            const view = await call(patient, '/waitlist/' + entryId);
            check(view.body.status === 'OFFERED' && String(view.body.offeredSlotId) === String(free.id),
                'the entry now points at the offered time', view.body.offeredTime);
            const notes = await call(patient, '/notifications');
            const told = (notes.body.notifications || []).find(n => n.type === 'WAITING_LIST');
            check(!!told, 'and the patient is told about it', told && told.title);
        } else {
            check(false, 'the clinic offers a free time', 'no free time with this doctor to offer');
        }

        /* her dashboard says so, too */
        const wOffer = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), patient);
        await wait(1400);
        check(/A time has opened up for you/.test(wOffer.document.body.textContent),
            'the patient sees the offer on her dashboard as soon as she signs in');
        const noticeButton = wOffer.document.querySelector('#waitOpen');
        check(!!noticeButton, 'with a button that takes her to her places');

        /* --------------------- 5b. somebody else takes the offered time first --- */
        console.log('\n5b. if another patient books that very time, the offer is taken back');
        const offeredNow = await call(patient, '/waitlist/' + entryId);
        if (offeredNow.body.status !== 'OFFERED') {
            check(false, 'the offer is withdrawn when the time is taken', 'the place is ' + offeredNow.body.status);
        } else {
            const quicker = (await call(admin, '/patients')).body.patients
                .find(person => String(person.id) !== String(offeredNow.body.patientId));
            const grabbed = await call(admin, '/appointments', { method: 'POST',
                body: { patientId: quicker.id, doctorId: offeredNow.body.doctorId,
                        slotId: offeredNow.body.offeredSlotId, reason: 'Taken before they could' } });
            const back = await call(patient, '/waitlist/' + entryId);
            check(grabbed.status === 200 && back.body.status === 'WAITING'
                    && !back.body.offeredTime && !back.body.offeredSlotId,
                'they keep their place, and the offer is cleared', back.body.status);
            const notes2 = await call(patient, '/notifications');
            check((notes2.body.notifications || []).some(n => /was taken/i.test(n.title || '')),
                'and they are told that the time went to somebody else');
            await call(admin, '/appointments/' + grabbed.body.appointment.id + '/cancel',
                { method: 'POST', body: { reason: 'Handed back after the check' } });
        }

        /* ----------------------------------------- 6. booking closes the place --- */
        console.log('\n6. booking the offered time closes the place');
        const free2 = (await call(admin, '/appointments/slots?doctorId=7')).body.slots[0];
        await call(admin, '/waitlist/' + entryId + '/offer',
            { method: 'POST', body: { slotId: free2.id, timeLabel: free2.timeLabel } });
        const view2 = await call(patient, '/waitlist/' + entryId);
        const booked = await call(patient, '/appointments', { method: 'POST',
            body: { doctorId: 7, slotId: view2.body.offeredSlotId, reason: 'Waiting-list check' } });
        check(booked.status === 200, 'the patient books it from the portal', booked.body.message);
        const after = await call(patient, '/waitlist/' + entryId);
        check(after.body.status === 'BOOKED', 'her place on the list is complete', after.body.statusLabel);

        /* --------------------------------- 7. a freed time goes to the waiter --- */
        console.log('\n7. a cancelled appointment is offered to the person waiting longest');
        /* a fresh place of our own, so the check never depends on earlier runs */
        const doctorsAll = await call(admin, '/doctors?activeOnly=true');
        let waitingPlace = null, waitingSlots = null;
        for (const candidate of (doctorsAll.body.doctors || [])) {
            const slots = await call(admin, '/appointments/slots?doctorId=' + candidate.id);
            if (!(slots.body.slots || []).length) continue;
            const joined3 = await call(patient, '/waitlist', { method: 'POST',
                body: { doctorId: candidate.id, preferredFrom: new Date().toISOString().slice(0, 10),
                        note: 'For the automatic-offer check' } });
            if (joined3.status === 200) {
                waitingPlace = joined3.body.entry;
                waitingSlots = slots.body.slots;
                break;
            }
        }
        if (!waitingPlace) {
            check(false, 'the freed time is offered', 'no free doctor could take a new place');
        } else {
            const free = waitingSlots[0];
            /* somebody else holds that time and then releases it */
            const onTheList = new Set([String(waitingPlace.patientId)]);
            const people = await call(admin, '/patients');
            const holder = (people.body.patients || []).find(p => !onTheList.has(String(p.id)));
            const held = await call(admin, '/appointments', { method: 'POST',
                body: { patientId: holder.id, doctorId: waitingPlace.doctorId, slotId: free.id,
                        reason: 'Held on purpose for the check' } });
            if (held.status !== 200) {
                check(false, 'the freed time is offered', held.body && held.body.message);
            } else {
                await call(admin, '/appointments/' + held.body.appointment.id + '/cancel',
                    { method: 'POST', body: { reason: 'Released on purpose for the check' } });
                const waiterNow = await call(admin, '/waitlist/' + waitingPlace.id);
                const fits = free.date >= waitingPlace.waitingSince;
                check(waiterNow.body.status === (fits ? 'OFFERED' : 'WAITING'),
                    fits ? 'the freed time was offered automatically, to the person waiting longest'
                         : 'a day outside their window was not offered',
                    waiterNow.body.status + (waiterNow.body.offeredTime ? ' · ' + waiterNow.body.offeredTime : ''));
                if (waiterNow.body.status === 'OFFERED') {
                    check(String(waiterNow.body.offeredSlotId) === String(free.id),
                        'and the offered time is recorded on the entry', waiterNow.body.offeredTime);
                    await call(patient, '/waitlist/' + waitingPlace.id + '/leave', { method: 'POST' });
                }
            }
        }

        /* ------------------------------------------------------ 8. leaving --- */
        console.log('\n8. the patient leaves the list');
        const joined2 = await call(patient, '/waitlist', { method: 'POST',
            body: { doctorId: 5, preferredFrom: '2026-10-12' } });
        const leaveId = joined2.body.entry ? joined2.body.entry.id : null;
        const left = await call(patient, '/waitlist/' + leaveId + '/leave', { method: 'POST' });
        check(left.status === 200, 'leaving the list works', left.body.message);
        const closed = await call(patient, '/waitlist/' + leaveId);
        check(closed.body.status === 'CANCELLED', 'and the place is closed', closed.body.statusLabel);
    } else {
        console.log('\n4-8. skipped: the data-changing checks were not asked for (read-only run)');
    }

    /* ----------------------------------------------------------- 9. the page */
    console.log('\n9. the page itself, in a browser engine');
    const wAdmin = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), admin);
    await wait(1400);
    await wAdmin.__App.go('waitlist');
    await wait(1600);
    const dA = wAdmin.document;
    await until(() => /Waiting list/.test((dA.querySelector('#pageTitle') || {}).textContent || ''), 'the clinic page');
    check(/Waiting list/.test(dA.querySelector('#pageTitle').textContent), 'the clinic\'s page carries the title');
    check(!!dA.querySelector('[data-wait-body] table.data, [data-wait-body] .empty'),
        'and draws the waiting list (a table, or a kind word when it is empty)');
    check(!!dA.querySelector('.search-box'), 'with a search box that matches the rest of the portal');
    check(!!dA.querySelector('[data-show]'), 'and a switch between what is open and the whole history');
    if (!READ_ONLY) {
        const waitSearch = dA.querySelector('#waitSearch');
        const rowsAll = dA.querySelectorAll('[data-wait-body] tbody tr').length;
        if (waitSearch && rowsAll) {
            waitSearch.value = 'zzzz-nobody';
            waitSearch.dispatchEvent(new wAdmin.Event('input', { bubbles: true }));
            await wait(700);
            const rowsFew = dA.querySelectorAll('[data-wait-body] tbody tr').length;
            check(rowsFew === 0 && /matches that search/.test(dA.body.textContent),
                'typing a name that nobody has narrows the list', rowsAll + ' → ' + rowsFew + ' row(s)');
            waitSearch.value = '';
            waitSearch.dispatchEvent(new wAdmin.Event('input', { bubbles: true }));
            await wait(700);
        }
        const toggle = dA.querySelector('[data-show]');
        const before = toggle.textContent.trim();
        toggle.dispatchEvent(new wAdmin.MouseEvent('click', { bubbles: true }));
        await wait(1500);
        const after = wAdmin.document.querySelector('[data-show]');
        check(!!after && after.textContent.trim() !== before,
            'and the switch really changes what is shown', before + ' → ' + (after ? after.textContent.trim() : '?'));
    }

    if (!READ_ONLY) {
        const rows = dA.querySelectorAll('[data-offer]');
        if (rows.length) {
            rows[0].dispatchEvent(new wAdmin.MouseEvent('click', { bubbles: true }));
            await wait(1400);
            const choices = dA.querySelectorAll('.slot-pick [data-slot]');
            check(choices.length >= 1, 'offering a free time opens the list of that doctor\'s times',
                choices.length + ' time(s)');
            const closeBtn = dA.querySelector('.modal [data-act="cancel"], [data-act="cancel"]');
            if (closeBtn) closeBtn.dispatchEvent(new wAdmin.MouseEvent('click', { bubbles: true }));
        } else {
            check(false, 'the offer button is on the page', 'no open place to offer a time to');
        }
    }

    const wPatient = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), patient);
    await wait(1400);
    await wPatient.__App.go('waitlist');
    await wait(1600);
    const dP = wPatient.document;
    let patientWords = await until(() => /Your places in the queue|We will tell you/.test(dP.body.textContent),
        'the patient page');
    if (!patientWords) {
        await wPatient.__App.go('waitlist');         /* one more try: a slow answer is not a fault */
        patientWords = await until(() => /Your places in the queue|We will tell you/.test(dP.body.textContent),
            'the patient page');
    }
    check(patientWords, 'the patient reads her own places, in her own words',
        patientWords ? undefined : 'the page showed: ' + dP.body.textContent.trim().slice(0, 60));

    const wDoctor = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), doctor);
    await wait(1400);
    await wDoctor.__App.go('waitlist');
    let doctorWords = await until(() => /waiting list/i.test(wDoctor.document.body.textContent),
        'the doctor page');
    if (!doctorWords) {
        await wDoctor.__App.go('waitlist');
        doctorWords = await until(() => /waiting list/i.test(wDoctor.document.body.textContent),
            'the doctor page');
    }
    check(doctorWords, 'a doctor sees their own waiting list too',
        doctorWords ? undefined : 'the page showed: ' + wDoctor.document.body.textContent.trim().slice(0, 60));

    console.log('\n  the invitation on the booking desk:');
    const wAny = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), admin);
    await wait(1200);
    const invite = wAny.MedCare.waitlist.waitingListInvite({ fullName: 'Aisha Nawaz', specialization: 'Paediatrician' });
    check(/No free time with Dr\. Aisha Nawaz/.test(invite) && /Join the waiting list/.test(invite),
        'when a doctor has no free time the patient is invited to the list');
    check(!/filter:\s*brightness/.test(fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8')),
        'and the button that invites them still keeps its words on hover');

    console.log('\n' + '─'.repeat(72));
    console.log((fail === 0 ? 'ALL GOOD' : 'PROBLEMS FOUND') + ' — ' + pass + ' checks passed, ' + fail + ' problem(s)');
    if (problems.length) {
        problems.forEach(p => console.log('   • ' + p));
    }
    process.exit(fail === 0 ? 0 : 1);
})().catch(error => {
    console.error('\nthe check itself stopped: ' + error.message);
    process.exit(2);
});
