/* =============================================================================
   The newest round of work, checked in a browser engine
   -----------------------------------------------------------------------------
   1. the header button keeps its words on hover (no filter tricks)
   2. the clinic documents are the system administrator's alone
   3. the new search boxes work, including the "/" shortcut and the clear cross
   4. the booking desk's doctor and patient lists are searchable
   5. the movement on the page is steady: one paint per frame, no blur on
      things that scroll, and nothing animating in a hidden tab

   Run:  node tools/ui-checks/round3.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/home/user/medical-appointment-system/frontend';
const BASE = process.env.CLINIC || 'http://localhost:8080';
const wait = ms => new Promise(r => setTimeout(r, ms));

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
    if (!res.ok) throw new Error('login failed for ' + username);
    return (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')])
        .filter(Boolean).map(c => c.split(';')[0]).join('; ');
}

function page(html, cookie, label) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message)));
    const dom = new JSDOM(html, { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const w = dom.window;
    w.matchMedia = q => ({ matches: /hover: hover/.test(q) ? false : false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
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
    const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

    /* ---------------------------------------------------------------- 1. hover */
    console.log('\n1. the sign-in button on the public header');
    check(!/filter:\s*brightness/.test(css), 'no button changes with a brightness filter any more');
    check(/\.btn-primary:hover\s*\{[^}]*background:/.test(css), 'hover changes the colour itself instead');
    const label = css.match(/\.btn > \*:not\(\.ripple\)\s*\{[^}]*z-index/);
    check(!!label, 'the words of a button sit above the light that sweeps across it');
    check(/\.btn:hover::after\s*\{\s*transform:/.test(css), 'the sweep moves with transform (no layout work per frame)');

    /* ------------------------------------------------------------- 2. documents */
    console.log('\n2. the clinic documents');
    check(/\{ id: 'reports'[^}]*roles: \['ADMIN'\]/.test(app), 'only the system administrator has the menu entry');
    check(/VIEW_ROLES|allowed && !allowed\.includes\(me\.role\)/.test(app), 'and the portal refuses to open the page for anybody else');
    const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'reception', password: 'reception123' }) });
    const receptionCookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get('set-cookie')])
        .filter(Boolean).map(c => c.split(';')[0]).join('; ');
    const adminCookie = await session('admin', 'admin123');
    const doctorCookie = await session('drsilva', 'doctor123');
    const patientCookie = await session('nimasha', 'patient123');
    for (const [who, cookie, wanted] of [['administrator', adminCookie, 200], ['front desk', receptionCookie, 403],
        ['doctor', doctorCookie, 403], ['patient', patientCookie, 403]]) {
        const res = await fetch(BASE + '/api/reports', { headers: { Cookie: cookie } });
        check(res.status === wanted, 'the ' + who + (wanted === 200 ? ' may open them' : ' may not'),
            'answer ' + res.status);
    }
    const file = await fetch(BASE + '/api/reports/patients.txt/content', { headers: { Cookie: receptionCookie } });
    check(file.status === 403, 'and cannot read a single file either', 'answer ' + file.status);

    /* every file on the page must really open and download - including the two
       that live in the reports folder, whose names hold a slash */
    const list = await fetch(BASE + '/api/reports', { headers: { Cookie: adminCookie } });
    const listed = (await list.json()).files || [];
    const missingKey = listed.filter(f => !f.key);
    check(missingKey.length === 0, 'every document on the page carries an address-safe key',
        listed.length + ' file(s)');
    let opened = 0, downloaded = 0, broken = [];
    for (const f of listed) {
        const open = await fetch(BASE + '/api/reports/' + encodeURIComponent(f.key || f.fileName) + '/content',
            { headers: { Cookie: adminCookie } });
        const grab = await fetch(BASE + '/api/reports/' + encodeURIComponent(f.key || f.fileName) + '/download',
            { headers: { Cookie: adminCookie } });
        if (open.status === 200) { opened++; } else { broken.push(f.fileName + ' (open ' + open.status + ')'); }
        if (grab.status === 200) { downloaded++; } else { broken.push(f.fileName + ' (download ' + grab.status + ')'); }
    }
    check(opened === listed.length && downloaded === listed.length,
        'the administrator can open and download every one of them',
        opened + '/' + listed.length + ' opened, ' + downloaded + '/' + listed.length + ' downloaded'
            + (broken.length ? ' — ' + broken.join(', ') : ''));

    /* --------------------------------------------------------------- 3. searches */
    console.log('\n3. the search boxes');
    check(/searchBox\(\{/.test(fs.readFileSync(path.join(ROOT, 'js/views/patients.js'), 'utf8')),
        'the records page uses the shared search box');
    check(!/⌕/.test(css), 'the old character magnifier is gone');

    const w = page(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'), adminCookie, 'admin');
    await wait(1500);
    await w.__App.go('patients');
    await wait(1200);
    const d = w.document;
    const box = d.querySelector('.search-box');
    check(!!box, 'the box is drawn on the page');
    check(!!box && !!box.querySelector('svg'), 'with a real magnifier icon');
    check(!!box && box.querySelector('.sb-key') && box.querySelector('.sb-key').textContent === '/', 'and the "/" hint');
    const input = d.querySelector('#search');
    const clear = d.querySelector('.search-box .sb-clear');
    check(!!input && !!clear, 'a clear cross is ready');
    check(clear && clear.hidden === true, 'hidden while the box is empty');
    if (input) {
        input.value = 'Nimasha';
        input.dispatchEvent(new w.Event('input', { bubbles: true }));
        await wait(700);
        check(!clear.hidden || clear.hidden === false, 'the cross appears once there is something to clear');
        const rows = d.querySelectorAll('#patientTable tbody tr').length;
        check(rows >= 1, 'typing narrows the list', rows + ' row(s)');
        clear.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await wait(700);
        check(input.value === '', 'the cross empties the box');
        /* the "/" shortcut */
        const other = d.querySelector('[data-view]');
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: '/', bubbles: true }));
        check(d.activeElement === input, 'and "/" jumps into the box from anywhere on the page');
    }

    /* ---------------------------------------------------------- 4. booking desk */
    console.log('\n4. the booking desk pickers');
    await w.__App.go('appointmentNew');
    await wait(1600);
    const comboFaces = d.querySelectorAll('.combo-face');
    check(comboFaces.length >= 1, 'the doctor list is a searchable picker', comboFaces.length + ' picker(s)');
    const doctorCombo = d.querySelector('.combo');
    check(!!doctorCombo, 'the picker is in the page');
    if (doctorCombo) {
        const face = doctorCombo.querySelector('.combo-face');
        face.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await wait(300);
        check(doctorCombo.classList.contains('is-open'), 'it opens on a click');
        const list = doctorCombo.querySelectorAll('.combo-item');
        check(list.length >= 4, 'the clinic\'s doctors are listed', list.length + ' rows');
        const search = doctorCombo.querySelector('.combo-input');
        search.value = 'derm';
        search.dispatchEvent(new w.Event('input', { bubbles: true }));
        await wait(250);
        const filtered = doctorCombo.querySelectorAll('.combo-item');
        check(filtered.length === 1, 'and searching filters them', filtered.length + ' row for "derm"');
        filtered[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await wait(900);
        const native = d.querySelector('[data-bk="doctor"]');
        check(!!native && native.value && native.value !== '', 'choosing a doctor records the choice',
            'doctor id ' + (native ? native.value : '?'));
        check(!!d.querySelector('[data-bk="slots"] [data-slot]'), 'and their free times load');
    }

    /* --------------------------------------------------------- 5. steady movement */
    console.log('\n5. steady movement');
    const stickyBlur = /table\.data thead th[^{]*\{[^}]*backdrop-filter/.test(css);
    check(!stickyBlur, 'the sticky table head no longer blurs on every scrolled frame');
    check(/will-change: transform/.test(css), 'things that move are given their own layer');
    check(/contain: layout style/.test(css), 'long lists are contained so filtering repaints only the list');
    check(/tab-hidden/.test(css) && /visibilitychange/.test(app), 'and animation pauses while the tab is in the background');
    check(/duration: 0\.9/.test(app) && /hover: hover/.test(app), 'smooth scrolling is calm and only for mouse wheels');
    check((app.match(/requestAnimationFrame\(paint\)/g) || []).length >= 1, 'scroll work is limited to one paint per frame');

    console.log('\n' + (fail === 0
        ? '✅ ROUND 3 CHECKS PASSED  (' + pass + ' checks, 0 problems)'
        : '❌ ROUND 3: ' + fail + ' PROBLEM(S)'));
    problems.forEach(p => console.log('   • ' + p));
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('round 3 crashed:', e); process.exit(1); });
