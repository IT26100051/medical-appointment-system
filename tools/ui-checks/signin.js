/* =============================================================================
   Sign-in page audit (jsdom against the running clinic)
   -----------------------------------------------------------------------------
   Drives the page the way a visitor does: shows and hides the password, opens
   the demonstration accounts, signs in with a wrong password, then with a right
   one, and checks what the page says and remembers at every step.

   Run:  node tools/ui-checks/signin.js        (the clinic must be running)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/home/user/medical-appointment-system/frontend';
const BASE = 'http://localhost:8080';
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(ok, label, detail) {
    if (ok) { pass++; console.log('  ✅ ' + label + (detail ? ' — ' + detail : '')); }
    else { fail++; console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

(async () => {
    const html = fs.readFileSync(path.join(ROOT, 'login.html'), 'utf8');

    /* the page really does send the visitor to the portal after sign-in */
    check(/window\.location\.href\s*=\s*'\/app'/.test(html),
        'the page sends a signed-in visitor to the portal');

    /* run a copy whose one navigation line is captured instead of followed,
       so this audit can watch where it would have gone */
    const watched = html.replace("window.location.href = '/app';", "window.__wentTo = '/app';");

    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message)));
    vc.on('error', (...a) => errors.push(a.join(' ')));

    const dom = new JSDOM(watched, {
        url: BASE + '/login', runScripts: 'outside-only',
        pretendToBeVisual: true, virtualConsole: vc, url: BASE + '/login'
    });
    const w = dom.window;
    const d = w.document;

    /* a browser's fetch and storage, backed by the real clinic */
    let cookie = '';
    w.fetch = async (url, options = {}) => {
        const res = await fetch(url.startsWith('http') ? url : BASE + url, {
            ...options, headers: { ...(options.headers || {}), Cookie: cookie }
        });
        const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        if (setCookie.length) cookie = setCookie.map(c => c.split(';')[0]).join('; ');
        const text = await res.text();
        return { ok: res.ok, status: res.status, json: async () => JSON.parse(text), text: async () => text };
    };
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.requestAnimationFrame = cb => setTimeout(() => cb(1), 16);
    w.onerror = (message) => errors.push(String(message));

    /* the bundled libraries, then the two scripts the page carries */
    w.eval(fs.readFileSync(path.join(ROOT, 'js/vendor.js'), 'utf8'));
    const scripts = [...watched.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    scripts.forEach(code => w.eval(code));
    await wait(900);

    const click = node => node.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const submit = () => d.getElementById('loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

    console.log('\nfirst look');
    check(d.querySelectorAll('svg').length > 3, 'the icons are drawn', d.querySelectorAll('svg').length + ' icons');
    check([...d.querySelectorAll('[data-lucide]')].every(el => el.tagName.toLowerCase() === 'svg'),
        'every icon placeholder became a real drawing');
    check(d.getElementById('chipDoctors').textContent.trim() === '4',
        'the specialist count comes from the clinic', 'reads "' + d.getElementById('chipDoctors').textContent.trim() + '"');
    check(!!d.querySelector('.login-logo') && d.querySelectorAll('.login-card').length === 1,
        'the card carries the logo and the form');
    check(d.querySelectorAll('.clinician, .clinician-photo').length === 0,
        'no stray clinician card on the sign-in form');
    check(d.getElementById('demoAccounts').classList.contains('hidden'), 'the demonstration accounts start hidden');

    console.log('\nshowing the password');
    const toggle = d.getElementById('pwdToggle');
    const pwd = d.getElementById('password');
    click(toggle); await wait(60);
    check(pwd.type === 'text', 'the password can be shown', 'box now ' + pwd.type);
    check(/eye-off/.test(toggle.innerHTML), 'the icon shows the change');
    check(toggle.getAttribute('aria-pressed') === 'true', 'a screen reader is told about it');
    click(toggle); await wait(60);
    check(pwd.type === 'password' && /data-lucide="eye"/.test(toggle.innerHTML), 'and hidden again');

    console.log('\nthe demonstration accounts');
    const link = d.getElementById('demoLink');
    click(link); await wait(60);
    check(!d.getElementById('demoAccounts').classList.contains('hidden'), 'the panel opens');
    check(link.getAttribute('aria-expanded') === 'true', 'and says so', 'label: "' + link.textContent.trim() + '"');
    const adminChip = [...d.querySelectorAll('#demoAccounts .chip')].find(c => c.dataset.u === 'admin');
    click(adminChip); await wait(60);
    check(d.getElementById('username').value === 'admin' && pwd.value === 'admin123',
        'clicking an account fills the form');
    click(link); await wait(60);
    check(d.getElementById('demoAccounts').classList.contains('hidden')
        && link.getAttribute('aria-expanded') === 'false', 'and it closes again');

    console.log('\na wrong password');
    d.getElementById('username').value = 'admin';
    pwd.value = 'not-the-password';
    submit(); await wait(900);
    const errorBox = d.getElementById('loginError');
    const message = errorBox.textContent.trim();
    check(message.length > 8, 'the page explains what went wrong', '"' + message + '"');
    check(!/undefined|null|Error:|fetch|500|stack/i.test(message), 'in plain words a patient understands');
    check(d.getElementById('loginBtn').disabled === false
        && d.getElementById('loginBtn').textContent.trim() === 'Sign in', 'the button is ready to try again');
    check(pwd.classList.contains('input-error') && d.getElementById('username').classList.contains('input-error'),
        'the fields are marked');

    console.log('\nthe right password');
    d.getElementById('username').value = 'nimasha';
    pwd.value = 'patient123';
    d.getElementById('remember').checked = true;
    submit(); await wait(1200);
    check(w.__wentTo === '/app', 'a signed-in visitor is sent to the portal', 'went to ' + w.__wentTo);
    check(/Welcome Nimasha/.test(d.getElementById('loginBtn').textContent),
        'and greeted by name', '"' + d.getElementById('loginBtn').textContent.trim() + '"');
    check(w.localStorage.getItem('medcare.username') === 'nimasha', 'the username is remembered');

    console.log('\ncoming back later');
    const dom2 = new JSDOM(html, { url: BASE + '/login', runScripts: 'outside-only', virtualConsole: vc });
    const w2 = dom2.window;
    w2.localStorage.setItem('medcare.username', 'nimasha');
    w2.matchMedia = w.matchMedia;
    w2.fetch = w.fetch;
    w2.eval(fs.readFileSync(path.join(ROOT, 'js/vendor.js'), 'utf8'));
    scripts.forEach(code => w2.eval(code));
    await wait(400);
    check(w2.document.getElementById('username').value === 'nimasha', 'the name is still in the box');
    check(w2.document.getElementById('remember').checked, 'and the switch is still on');

    console.log('\nnothing broke along the way');
    check(errors.length === 0, 'no script errors on the page', errors.slice(0, 2).join(' | ') || 'none');

    console.log('\n' + (fail === 0
        ? '✅ SIGN-IN PAGE PASSED  (' + pass + ' checks, 0 problems)'
        : '❌ SIGN-IN PAGE: ' + fail + ' PROBLEM(S)'));
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('audit crashed:', e); process.exit(1); });
