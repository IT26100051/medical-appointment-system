/* Headless UI verification of the re-branded front end:
   boots app.html + app.js in jsdom against the running server,
   visits every page for every role and reports any JS error. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.MEDCARE_URL || 'http://localhost:8080';
const STATIC = '/home/user/medical-appointment-system/frontend';

async function login(username, password) {
    const response = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error('login failed for ' + username);
    const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')];
    const cookie = cookies.map(c => c.split(';')[0]).join('; ');
    const user = (await response.json()).user;
    return { cookie, user };
}

/* minimal stand-ins for the browser APIs jsdom does not implement */
function stubs(window) {
    window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.scrollTo = () => {};
    window.Element.prototype.scrollIntoView = function () {};
}

async function runRole(roleName, username, password, views) {
    const { cookie, user } = await login(username, password);
    const html = fs.readFileSync(path.join(STATIC, 'app.html'), 'utf8');
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack ? e.detail.stack : e.message || e)));
    virtualConsole.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));

    const dom = new JSDOM(html, { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
    const window = dom.window;
    stubs(window);
    window.addEventListener('error', e => errors.push('window.onerror: ' + (e.error?.stack || e.message)));
    window.addEventListener('unhandledrejection', e => errors.push('unhandledRejection: ' + (e.reason?.stack || e.reason)));

    window.fetch = async (url, options = {}) => {
        const target = url.startsWith('http') ? url : BASE + url;
        const response = await fetch(target, { ...options, headers: { ...(options.headers || {}), Cookie: cookie }, redirect: 'manual' });
        const text = await response.text();
        const isJson = (response.headers.get('content-type') || '').includes('json') && text;
        const payload = isJson ? JSON.parse(text) : text;
        return {
            ok: response.ok, status: response.status,
            headers: { get: n => response.headers.get(n) },
            json: async () => payload, text: async () => text
        };
    };

    /* the library bundle first - the real page loads js/vendor.js before
       js/app.js, so the sweep must exercise the same path the browser does */
    const vendor = fs.readFileSync(path.join(STATIC, 'js', 'vendor.js'), 'utf8');
    window.eval(vendor);
    const source = fs.readFileSync(path.join(STATIC, 'js', 'app.js'), 'utf8');
    window.eval(source + '\n;window.__App = App;');
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    await new Promise(r => setTimeout(r, 800));

    const splashHidden = window.document.querySelector('#splash')?.classList.contains('hidden')
        || !window.document.querySelector('#splash');
    const brandLogo = !!window.document.querySelector('.brand-logo');
    const navCount = window.document.querySelectorAll('.nav-item').length;
    console.log(`\n=== ${roleName} (${username}) — role ${user.role} · splash hidden: ${splashHidden} · logo: ${brandLogo} · menu items: ${navCount} ===`);

    for (const view of views) {
        errors.length = 0;
        try { window.__App.go(view); } catch (e) { errors.push('go() threw: ' + e.message); }
        await new Promise(r => setTimeout(r, 450));
        const container = window.document.querySelector('#view');
        const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
        const stuck = text.includes('Loading ') && text.length < 90;
        const status = errors.length ? '❌' : stuck ? '⚠️ STUCK' : text.length < 15 ? '⚠️ EMPTY' : '✅';
        console.log(`  ${status} ${view.padEnd(15)} ${text.substring(0, 74)}`);
        errors.slice(0, 2).forEach(e => console.log('        ↳ ' + String(e).split('\n')[0].substring(0, 160)));
    }

    /* a couple of interaction checks on the dashboard */
    window.__App.go('dashboard');
    await new Promise(r => setTimeout(r, 700));
    const counters = Array.from(window.document.querySelectorAll('.stat .value')).map(n => n.textContent);
    console.log('  counters rendered:', counters.join(' | '));

    dom.window.close();
}

(async () => {
    await runRole('ADMIN', 'admin', 'admin123', ['dashboard', 'patientNew', 'patients', 'doctorNew', 'doctors',
        'appointmentNew', 'appointments', 'waitingRoom', 'scheduleNew', 'schedule', 'feedback', 'notifications', 'staff', 'reports', 'account']);
    await runRole('RECEPTIONIST', 'reception', 'reception123', ['dashboard', 'patients', 'doctors', 'appointments', 'waitingRoom',
        'schedule', 'reports', 'notifications', 'account']);
    await runRole('DOCTOR', 'drsilva', 'doctor123', ['dashboard', 'doctors', 'doctorProfile', 'appointments', 'waitingRoom',
        'schedule', 'feedback', 'notifications', 'account']);
    await runRole('PATIENT', 'nimasha', 'patient123', ['dashboard', 'myProfile', 'appointmentNew', 'appointments',
        'feedbackNew', 'notifications', 'account']);
    console.log('\nUI verification finished.');
})();
