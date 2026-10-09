/* checks the public clinic home page and the portal's new visuals */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = process.env.MEDCARE_URL || 'http://localhost:8080';
const FRONT = '/home/user/medical-appointment-system/frontend';

function stubs(window) {
    window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
    window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
    window.scrollTo = () => {};
    window.Element.prototype.scrollIntoView = function () {};
}

async function login(u, p) {
    const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    const c = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).map(x => x.split(';')[0]).join('; ');
    return c;
}

setTimeout(() => { console.error('HARD TIMEOUT - exiting'); process.exit(1); }, 90000);

(async () => {
    // ---------- 1. public home page ----------
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message)));
    const dom = new JSDOM(fs.readFileSync(FRONT + '/index.html', 'utf8'),
        { url: BASE + '/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const w = dom.window;
    stubs(w);
    w.fetch = async (url, options = {}) => {
        const res = await fetch(url.startsWith('http') ? url : BASE + url, options);
        const text = await res.text();
        return { ok: res.ok, status: res.status, headers: { get: n => res.headers.get(n) }, json: async () => JSON.parse(text), text: async () => text };
    };
    w.eval(fs.readFileSync(FRONT + '/js/home.js', 'utf8'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 1200));
    const d = w.document;
    console.log('HOME PAGE');
    console.log('  doctor cards        :', d.querySelectorAll('.doctor-card').length);
    console.log('  speciality cards    :', d.querySelectorAll('.specialty-card').length, '|', [...d.querySelectorAll('.specialty-card h3')].map(e => e.textContent).join(', '));
    console.log('  doctor photos used  :', [...d.querySelectorAll('.doctor-card .dc-photo')].filter(e => (e.getAttribute('style') || '').includes('/img/people/')).length);
    console.log('  next-free badges    :', d.querySelectorAll('.dc-next').length);
    console.log('  quick tiles / steps :', d.querySelectorAll('.quick-tile').length, '/', d.querySelectorAll('.step').length);
    console.log('  header portal link  :', d.querySelector('#portalBtn') ? 'yes' : 'no', '| footer year', d.querySelector('#year').textContent);
    console.log('  search filter works :', 
(async () => {
        d.querySelector('#searchText').value = 'skin';
        d.querySelector('#searchForm').dispatchEvent(new w.Event('submit'));
        return d.querySelectorAll('.doctor-card').length + ' card(s) for "skin"';
    })());
    console.log('  js errors           :', errors.length ? errors : 'none');

    // ---------- 2. portal visuals for a patient ----------
    const cookie = await login('nimasha', 'patient123');
    const vc2 = new VirtualConsole(); const errors2 = [];
    vc2.on('jsdomError', e => errors2.push(String(e.message)));
    const dom2 = new JSDOM(fs.readFileSync(FRONT + '/app.html', 'utf8'),
        { url: BASE + '/app', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc2 });
    const w2 = dom2.window;
    stubs(w2);
    w2.fetch = async (url, options = {}) => {
        const res = await fetch(url.startsWith('http') ? url : BASE + url, { ...options, headers: { ...(options.headers || {}), Cookie: cookie } });
        const text = await res.text();
        return { ok: res.ok, status: res.status, headers: { get: n => res.headers.get(n) }, json: async () => JSON.parse(text), text: async () => text };
    };
    w2.addEventListener('error', e => errors2.push(String(e.error)));
    w2.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));   // the real page loads this first
    w2.eval(fs.readFileSync(FRONT + '/js/app.js', 'utf8') + ';window.__App = App;');
    await new Promise(r => setTimeout(r, 900));
    const A = w2.__App, d2 = w2.document;
    await A.go('dashboard');
    await new Promise(r => setTimeout(r, 500));
    console.log('\nPORTAL (patient)');
    console.log('  sidebar photo       :', d2.querySelector('#sideAvatar img') ? d2.querySelector('#sideAvatar img').getAttribute('src') : 'none');
    console.log('  greeting photo      :', d2.querySelectorAll('.hero-panel .avatar-img, .hero-panel .avatar-img img').length, 'photo(s) on the dashboard');
    console.log('  next-visit card     :', d2.querySelector('.next-visit .nv-title') ? d2.querySelector('.next-visit .nv-title').textContent : 'not shown');
    console.log('  place in line       :', d2.querySelector('#myPlace .my-place') ? 'shown' : (d2.querySelector('#myPlace') ? 'empty (no upcoming visit)' : 'no card'));
    console.log('  avatars in tables   :', d2.querySelectorAll('table .avatar img, table .avatar svg, table .avatar-init').length);
    await A.go('appointmentNew');
    await new Promise(r => setTimeout(r, 700));
    console.log('  doctor choices      :', d2.querySelectorAll('#bkDoctor option[value]:not([value=""])').length, '| with photos:',
        d2.querySelectorAll('.book-doctor .avatar-img').length, 'in the summary');
    await A.go('myProfile');
    await new Promise(r => setTimeout(r, 500));
    console.log('  profile photo       :', d2.querySelector('.ph-block .avatar-img') ? d2.querySelector('.ph-block .avatar-img').getAttribute('src') : 'none');
    console.log('  js errors           :', errors2.length ? errors2 : 'none');
    process.exit(0);
})();
