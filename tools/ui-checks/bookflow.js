/* Walks the booking page exactly like a patient does: choose a doctor, choose
   a day, choose a free time, press "Confirm the appointment". Reports what the
   page shows at every step, so a failure is visible with its real message. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.CLINIC || 'http://localhost:8080';
const STATIC = '/home/user/medical-appointment-system/frontend';
const whom = process.argv[2] || 'nimasha';
const pass = process.argv[3] || 'patient123';

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const login = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: whom, password: pass })
    });
    if (!login.ok) { console.log('login failed', login.status); process.exit(1); }
    const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get('set-cookie')])
        .map(c => c.split(';')[0]).join('; ');

    const dom = new JSDOM(fs.readFileSync(path.join(STATIC, 'app.html'), 'utf8'),
        { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
    const w = dom.window;
    w.matchMedia = q => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.requestAnimationFrame = cb => setTimeout(() => cb(1), 16);
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
    w.fetch = async (url, options = {}) => {
        const target = url.startsWith('http') ? url : BASE + url;
        const res = await fetch(target, { ...options, headers: { ...(options.headers || {}), Cookie: cookie }, redirect: 'manual' });
        const text = await res.text();
        return {
            ok: res.ok, status: res.status,
            headers: { get: n => res.headers.get(n) },
            json: async () => JSON.parse(text), text: async () => text
        };
    };

    w.eval(fs.readFileSync(path.join(STATIC, 'js/vendor.js'), 'utf8'));
    w.eval(fs.readFileSync(path.join(STATIC, 'js/app.js'), 'utf8') + ';window.__App = App;');
    w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
    await wait(1200);

    const d = w.document;
    const click = node => node.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const change = node => node.dispatchEvent(new w.Event('change', { bubbles: true }));
    const toastText = () => {
        const items = [...d.querySelectorAll('.toast, .toast-item, [class*=toast]')].map(n => n.textContent.trim());
        return items.filter(Boolean).join(' | ') || '(no toast)';
    };
    const step = (label, value) => console.log(`  ${label.padEnd(26)} ${value}`);

    await w.__App.go('appointmentNew');
    await wait(1400);

    step('page', (d.querySelector('#pageTitle') || {}).textContent);
    const whoLine = d.querySelector('[data-bk="who-name"]');
    step('booked for', whoLine ? whoLine.textContent : '(no self line)');

    const mode = process.argv[4] || 'existing';
    if (mode === 'new') {
        const toggle = d.querySelector('[data-bk="new-toggle"]');
        step('walk-in switch', !!toggle);
        if (toggle) { click(toggle); await wait(500); }
        const nm = d.querySelector('[data-bk="new-name"]');
        if (nm) { nm.value = 'Walk In Test'; change(nm); }
        const ph = d.querySelector('[data-bk="new-phone"]');
        if (ph) { ph.value = '077 000 1122'; change(ph); }
    } else {
        const ps = d.querySelector('[data-bk="patient"]');
        step('patients offered', ps ? ps.options.length - 1 : 0);
        if (ps && ps.options.length > 1) { ps.value = ps.options[1].value; change(ps); }
    }

    const doctor = d.querySelector('[data-bk="doctor"]');
    step('doctors offered', doctor ? doctor.options.length - 1 : 0);
    if (!doctor || doctor.options.length < 2) { console.log('  no doctors to choose - stopping'); process.exit(1); }
    doctor.value = doctor.options[1].value;
    change(doctor);
    await wait(1200);

    const day = d.querySelector('[data-bk="days"] [data-day]');
    step('first day offered', day ? day.dataset.day : '(none)');
    if (day) { click(day); await wait(1200); }

    const slot = d.querySelector('[data-bk="slots"] [data-slot]');
    step('first free time', slot ? slot.textContent.trim().replace(/\s+/g, ' ') : '(none)');
    if (!slot) { console.log('  no free times - stopping'); process.exit(1); }
    click(slot);
    await wait(400);

    const summary = d.querySelector('[data-bk="summary"]');
    step('summary shows', summary ? summary.textContent.replace(/\s+/g, ' ').slice(0, 80) : '(none)');

    const submit = d.querySelector('[data-bk="submit"]');
    step('confirm button enabled', submit && !submit.disabled);
    click(submit);
    await wait(2500);

    const bookingMessage = toastText();
    step('toast', bookingMessage);
    const bookedRef = (bookingMessage.match(/APT-\d{8}-\d+/) || [])[0];
    if (!bookedRef) throw new Error('Booking confirmation did not contain an appointment reference');
    const stillHere = !!d.querySelector('[data-bk="submit"]');
    const nowOn = (d.querySelector('#pageTitle') || {}).textContent;
    step('after booking', stillHere ? 'still on the booking page' : 'left the booking page');
    step('window title now', nowOn);

    /* the new appointment must be in the patient's own list */
    await w.__App.go('appointments');
    await wait(1200);
    const rows = [...d.querySelectorAll('#appointmentTable tbody tr')];
    step('appointments listed', rows.length);
    const mine = rows.find(r => r.textContent.includes(bookedRef));
    step('newest visit', mine ? mine.textContent.replace(/\s+/g, ' ').slice(0, 90) : '(not found)');

    if (!mine) throw new Error('Newly booked appointment ' + bookedRef + ' is missing from the visible list');
    process.exit(0);
})();
