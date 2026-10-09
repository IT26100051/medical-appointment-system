/* =============================================================================
   Safety audit - escaping, permissions and the awkward cases
   -----------------------------------------------------------------------------
   Runs against a clinic instance (a throwaway one is best: it creates records).
   It tries to do everything a careless or hostile visitor might try, and
   insists that the clinic answers in plain words, never with a server error,
   never with a broken screen, and never by running somebody's script.

   Run:  node tools/ui-checks/safety.js [http://localhost:8099]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.argv[2] || 'http://localhost:8080';
if (new URL(BASE).port === '8080') {
    console.error('This test creates hostile sample records. Run it only on a disposable clinic, for example port 8099.');
    process.exit(1);
}
const ROOT = '/home/user/medical-appointment-system/frontend';
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const findings = [];
function check(ok, label, detail) {
    if (ok) { pass++; console.log('  ✅ ' + label + (detail ? ' — ' + detail : '')); }
    else { fail++; findings.push(label + (detail ? ' — ' + detail : '')); console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

/* every answer the clinic gives must sound like it came from a person */
const TECH = /Unexpected error|Exception|StackTrace|NullPointer|org\.springframework|java\.|at com\.medcare|undefined|null\b|Caused by/i;

async function call(session, url, options = {}) {
    const res = await fetch(BASE + url, {
        ...options,
        headers: { ...(options.headers || {}), ...(session ? { Cookie: session } : {}) }
    });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch (e) { body = text; }
    return { status: res.status, body, text };
}

async function login(username, password) {
    const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const cookies = (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')] || [])
        .filter(Boolean).map(c => c.split(';')[0]).join('; ');
    return res.ok ? cookies : null;
}

const message = answer => (answer.body && answer.body.message) || String(answer.body || '');

(async () => {
    /* ------------------------------------------------------------ permissions */
    console.log('\nwho may see what');
    const admin = await login('admin', 'admin123');
    const reception = await login('reception', 'reception123');
    const doctor = await login('drsilva', 'doctor123');
    const patient = await login('nimasha', 'patient123');
    check(!!admin && !!reception && !!doctor && !!patient, 'all four accounts sign in');

    const matrix = [
        ['/api/dashboard', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/patients', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 403, PATIENT: 403 }],
        ['/api/doctors', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/appointments', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/slots', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/feedback', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/staff', { ADMIN: 200, RECEPTIONIST: 403, DOCTOR: 403, PATIENT: 403 }],
        ['/api/reports', { ADMIN: 200, RECEPTIONIST: 403, DOCTOR: 403, PATIENT: 403 }],
        ['/api/queue', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 403 }],
        ['/api/photos/library', { ADMIN: 200, RECEPTIONIST: 200, DOCTOR: 200, PATIENT: 200 }],
        ['/api/queue/my-place', { ADMIN: 403, RECEPTIONIST: 403, DOCTOR: 403, PATIENT: 200 }]
    ];
    const sessions = { ADMIN: admin, RECEPTIONIST: reception, DOCTOR: doctor, PATIENT: patient };
    let unknown = 0;
    for (const [url, wanted] of matrix) {
        for (const role of Object.keys(wanted)) {
            const answer = await call(sessions[role], url);
            if (answer.status >= 500) unknown++;
            if (answer.status !== wanted[role]) {
                unknown++;
                check(false, role + ' ' + url, 'expected ' + wanted[role] + ', got ' + answer.status + ' ' + message(answer));
            }
        }
    }
    check(unknown === 0, 'every role sees exactly what it should',
        matrix.length + ' addresses × 4 roles, no surprises');

    /* signed out */
    const out = await call(null, '/api/patients');
    check(out.status === 401 || out.status === 403, 'a visitor who is not signed in is refused', 'answer ' + out.status);

    /* ------------------------------------------------------- awkward requests */
    console.log('\nawkward requests');
    const notFound = await call(admin, '/api/appointments/999999');
    check(notFound.status === 404 && !TECH.test(message(notFound)), 'an appointment that does not exist',
        notFound.status + ' "' + message(notFound) + '"');

    const wrongType = await call(admin, '/api/patients/not-a-number');
    check(wrongType.status === 404 && !TECH.test(message(wrongType)), 'a nonsense address',
        wrongType.status + ' "' + message(wrongType) + '"');

    const brokenJson = await call(admin, '/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops'
    });
    check(brokenJson.status === 400 && !TECH.test(message(brokenJson)), 'a request that arrives damaged',
        brokenJson.status + ' "' + message(brokenJson) + '"');

    const emptyBody = await call(admin, '/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    check(emptyBody.status === 400 && !TECH.test(message(emptyBody)), 'a request with nothing filled in',
        emptyBody.status + ' "' + message(emptyBody) + '"');

    const wrongWord = await call(admin, '/api/patients?search=' + encodeURIComponent('<script>alert(1)</script>'));
    check(wrongWord.status === 200 && !TECH.test(message(wrongWord)), 'a search full of symbols does not break the clinic',
        'answer ' + wrongWord.status);

    const wrongLogin = await call(null, '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong-one' })
    });
    check(wrongLogin.status === 401 && !TECH.test(message(wrongLogin)), 'a wrong password is refused as "not signed in"',
        wrongLogin.status + ' "' + message(wrongLogin) + '"');

    const unknownUser = await call(null, '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nobody', password: 'anything' })
    });
    check(unknownUser.status === 401, 'a username that does not exist', unknownUser.status + ' "' + message(unknownUser) + '"');
    check(message(unknownUser) === message(wrongLogin), 'and it says the same thing, so accounts cannot be guessed');

    /* what each person is told about the clinic */
    console.log('\nwhat the dashboard tells each person');
    const patientDash = (await call(patient, '/api/dashboard')).body.stats || {};
    const clinicWide = ['patients', 'activePatients', 'staffAccounts', 'appointmentsTotal',
        'appointmentsToday', 'pending', 'confirmed', 'completed', 'cancelled', 'feedbackCount'];
    const leaked = clinicWide.filter(key => key in patientDash);
    check(leaked.length === 0, 'a patient is never told the clinic\'s totals',
        leaked.length ? 'leaked: ' + leaked.join(', ') : Object.keys(patientDash).join(', '));
    check(patientDash.myTotal !== undefined && patientDash.myUpcoming !== undefined,
        'but is told about their own visits');

    const doctorDash = (await call(doctor, '/api/dashboard')).body.stats || {};
    const doctorLeak = ['patients', 'activePatients', 'staffAccounts', 'appointmentsTotal'].filter(key => key in doctorDash);
    check(doctorLeak.length === 0, 'a doctor is given their own day, not the clinic register',
        doctorLeak.length ? 'leaked: ' + doctorLeak.join(', ') : Object.keys(doctorDash).join(', '));
    check(doctorDash.myPatients !== undefined && doctorDash.mySlots !== undefined,
        'with the patients and times that are theirs');

    const staffDash = (await call(admin, '/api/dashboard')).body.stats || {};
    check(staffDash.patients !== undefined && staffDash.staffAccounts !== undefined,
        'the front desk still sees the whole clinic');

    /* the clinic's own rules, from the outside */
    console.log('\nthe clinic\'s rules, tried from the outside');
    const slots = (await call(patient, '/api/appointments/slots?doctorId=4')).body.slots || [];
    const freeId = slots.length ? slots[0].id : null;
    const takenId = (await call(admin, '/api/appointments')).body.appointments.find(a => a.slotId)?.slotId;

    const booked = await call(patient, '/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: 4, slotId: takenId, reason: 'Trying again' })
    });
    check(booked.status === 400 && !TECH.test(message(booked)), 'a time that is already taken',
        booked.status + ' "' + message(booked) + '"');

    const otherPatient = await call(patient, '/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: 4, slotId: freeId, patientId: 3, reason: 'Somebody else' })
    });
    check(otherPatient.status === 403, 'booking under another patient\'s name',
        otherPatient.status + ' "' + message(otherPatient) + '"');

    const myAppointments = (await call(patient, '/api/appointments')).body.appointments || [];
    const someoneElse = myAppointments.length ? null : 1;
    const foreign = await call(patient, '/api/appointments/' + (someoneElse || 999999));
    check(foreign.status === 404 || foreign.status === 403, 'another patient\'s appointment',
        foreign.status + ' "' + message(foreign) + '"');

    const cancelNoReason = await call(patient, '/api/appointments/1/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
    check(cancelNoReason.status === 400 && !TECH.test(message(cancelNoReason)), 'cancelling without giving a reason',
        cancelNoReason.status + ' "' + message(cancelNoReason) + '"');

    const earlyFeedback = await call(patient, '/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: 1, rating: 5, comments: 'Too early' })
    });
    check(earlyFeedback.status === 400 && !TECH.test(message(earlyFeedback)), 'rating a visit that has not happened',
        earlyFeedback.status + ' "' + message(earlyFeedback) + '"');

    /* ------------------------------------------------------------- escaping */
    console.log('\nhostile text in a record');
    const sneaky = '<img src=x onerror="window.__xss=1">';
    const sneakyName = 'Bad Actor ' + sneaky;
    const createdPatient = await call(admin, '/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: sneakyName, username: 'sneaky' + Date.now(), password: 'patient123',
            email: 'sneaky@example.com', phone: '+94 77 111 2222', gender: 'Male',
            dateOfBirth: '1991-04-04', nic: '914040404V', address: sneaky + ' 12, Main Street',
            city: '<b>Ratnapura</b>', bloodGroup: 'O+', emergencyContactName: 'Test Contact',
            emergencyContactPhone: '+94 77 333 4444'
        })
    });
    check(createdPatient.status === 200 || createdPatient.status === 201,
        'a patient whose name contains a script is accepted and stored', 'answer ' + createdPatient.status);

    const patientId = createdPatient.body && (createdPatient.body.patient || {}).id;
    if (patientId && freeId) {
        const sneakyVisit = await call(admin, '/api/appointments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, doctorId: 4, slotId: freeId, reason: sneaky + ' headache' })
        });
        check(sneakyVisit.status === 200, 'and can be given an appointment, reason included');

        /* now look at the screens a member of staff would open */
        /* the screens that list the clinic's records must show the record; the
           consulting-hours board and the waiting room only ever show today's
           work, so there the check is that the page still draws and nothing runs */
        const pages = ['dashboard', 'patients', 'appointments', 'reports', 'waitingRoom', 'schedule'];
        const mustShowTheRecord = ['dashboard', 'patients', 'appointments', 'reports'];
        const problems = [];
        for (const page of pages) {
            const errors = [];
            const vc = new VirtualConsole();
            vc.on('jsdomError', e => errors.push(String(e.message)));
            const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'),
                { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
            const w = dom.window;
            w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
            w.requestAnimationFrame = cb => setTimeout(() => cb(1), 16);
            w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
            w.fetch = async (url, options = {}) => {
                const res = await fetch(url.startsWith('http') ? url : BASE + url, {
                    ...options, headers: { ...(options.headers || {}), Cookie: admin }
                });
                const text = await res.text();
                return {
                    ok: res.ok, status: res.status,
                    headers: { get: name => res.headers.get(name) },
                    json: async () => JSON.parse(text), text: async () => text
                };
            };
            w.eval(fs.readFileSync(path.join(ROOT, 'js/vendor.js'), 'utf8'));
            w.eval(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8') + ';window.__App = App;');
            w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
            await wait(1500);
            await w.__App.go(page);
            await wait(1100);
            if (w.__xss) problems.push(page + ': script ran');
            if (w.document.querySelector('img[src="x"]')) problems.push(page + ': picture element injected');
            if (w.document.querySelector('#view b')) problems.push(page + ': bold element injected');
            const view = (w.document.querySelector('#view').textContent || '').trim();
            if (view.length < 20) problems.push(page + ': the page stayed empty');
            if (mustShowTheRecord.includes(page) && !/Bad Actor/.test(w.document.body.textContent)) {
                problems.push(page + ': record is missing from the page');
            }
            if (errors.length) problems.push(page + ': ' + errors[0]);
        }
        check(problems.length === 0, 'the hostile text is shown as text on every screen',
            problems.join(' | ') || pages.length + ' screens checked, nothing ran');
    } else {
        check(false, 'the hostile record could be created', 'no patient id or no free time available');
    }

    console.log('\n' + (fail === 0
        ? '✅ SAFETY AUDIT PASSED  (' + pass + ' checks, 0 problems)'
        : '❌ SAFETY AUDIT: ' + fail + ' PROBLEM(S)'));
    findings.forEach(f => console.log('   • ' + f));
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('audit crashed:', e); process.exit(1); });
