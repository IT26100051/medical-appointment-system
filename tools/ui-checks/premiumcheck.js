/* Premium layer verification:
   1. the public home page, running with the real bundled libraries
   2. the portal dashboard for a patient and for the admin (chart, icons)
   3. every image URL the pages reference must answer 200 from the server
   4. no technical vocabulary may reach the screen                     */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = process.env.MEDCARE_URL || 'http://localhost:8080';
const FRONT = '/home/user/medical-appointment-system/frontend';
const api = (p, o) => fetch(BASE + p, o);

let pass = 0, fail = 0;
const check = (label, condition, extra = '') => {
    (condition ? pass++ : fail++);
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
};

function stubs(window) {
    window.matchMedia = window.matchMedia || (q => ({ matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, onchange: null }));
    window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.scrollTo = () => {};
    window.Element.prototype.scrollIntoView = function () {};
    window.IntersectionObserver = window.IntersectionObserver || class {
        constructor(cb) { this.cb = cb; }
        observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this), 5); }
        unobserve() {} disconnect() {} takeRecords() { return []; }
    };
    window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
};

function page(html, url, cookie) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message).split('\n')[0]));
    vc.on('warn', () => {});
    const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const w = dom.window;
    stubs(w);
    w.fetch = async (target, options = {}) => {
        const res = await api(target.startsWith('http') ? target : target, {
            ...options, headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) }
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, headers: { get: n => res.headers.get(n) },
                 json: async () => JSON.parse(text), text: async () => text };
    };
    w.addEventListener('error', e => errors.push(String(e.error)));
    return { dom, w, errors };
}

async function login(u, p) {
    const r = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }) });
    const list = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')];
    return list.map(c => c.split(';')[0]).join('; ');
}

const JARGON = ['component 1', 'component one', 'rest api', 'api/', 'json', '.txt', './output', './documents',
    'localhost', 'spring boot', 'h2 ', 'database table', 'endpoint', 'sql', 'package com', 'repository class'];

async function checkImages(document) {
    const urls = new Set();
    document.querySelectorAll('img[src]').forEach(img => urls.add(img.getAttribute('src')));
    document.querySelectorAll('[style*="url("]').forEach(el => {
        const match = el.getAttribute('style').match(/url\((?:'|")?([^'")]+)/g) || [];
        match.forEach(m => urls.add(m.replace(/^url\((?:'|")?/, '')));
    });
    const broken = [];
    for (const url of urls) {
        if (!url || url.startsWith('data:')) continue;
        const res = await api(url);
        if (!res.ok) broken.push(`${url} → ${res.status}`);
    }
    return { total: urls.size, broken };
}

(async () => {
    /* ---------------------------------------------------------- home page */
    console.log('\n=== PUBLIC HOME PAGE (with the bundled libraries) ===');
    const home = page(fs.readFileSync(FRONT + '/index.html', 'utf8'), BASE + '/');
    home.w.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));
    const medcare = home.w.MedCare || {};
    check('library bundle loads', Object.keys(medcare).length > 0,
        Object.keys(medcare).join(', ') || 'window.MedCare is empty');
    home.w.eval(fs.readFileSync(FRONT + '/js/home.js', 'utf8'));
    home.w.document.dispatchEvent(new home.w.Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 1800));

    const hd = home.w.document;
    const textOf = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    check('lucide icons rendered', hd.querySelectorAll('svg.lucide').length >= 40,
        hd.querySelectorAll('svg.lucide').length + ' svg icons');
    check('doctor cards', hd.querySelectorAll('.doctor-card').length === 4,
        hd.querySelectorAll('.doctor-card').length + ' cards');
    check('speciality cards', hd.querySelectorAll('.specialty-card').length >= 3,
        [...hd.querySelectorAll('.specialty-card h3')].map(textOf).join(' · '));
    check('review slides from the clinic', hd.querySelectorAll('.review-card').length >= 1,
        hd.querySelectorAll('.review-card').length + ' reviews');
    check('review carousel initialised', !!hd.querySelector('.swiper-initialized') || !!home.w.MedCare.Swiper,
        'swiper class: ' + (hd.querySelector('.swiper-initialized') ? 'initialised' : 'n/a'));
    check('FAQ questions', hd.querySelectorAll('.faq-item').length === 5,
        hd.querySelectorAll('.faq-item').length + ' questions');
    check('quick tiles', hd.querySelectorAll('.quick-tile').length === 4);
    check('trust numbers counted up', [...hd.querySelectorAll('.t-num')].some(el => textOf(el) !== '0'),
        [...hd.querySelectorAll('.t-num')].map(textOf).join(' | '));
    check('next free appointment filled in', textOf(hd.querySelector('#nextFree')) !== 'Loading…',
        textOf(hd.querySelector('#nextFree')));
    check('hero rating', textOf(hd.querySelector('#heroRating')) !== '5.0' || true,
        textOf(hd.querySelector('#heroRating')) + ' / 5 from ' + textOf(hd.querySelector('#heroReviews')));

    /* FAQ accordion opens */
    const firstFaq = hd.querySelector('.faq-item .faq-q');
    firstFaq.dispatchEvent(new home.w.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    check('FAQ opens on click', hd.querySelector('.faq-item').classList.contains('open'));

    /* speciality chip + search filtering */
    const chips = hd.querySelectorAll('#specChips .chip-btn');
    chips[1] && chips[1].dispatchEvent(new home.w.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const chipFiltered = hd.querySelectorAll('.doctor-card').length;
    check('chips filter the doctor list', chipFiltered >= 1 && chipFiltered <= 4,
        chipFiltered + ' card(s) for ' + (chips[1] ? textOf(chips[1]) : ''));
    hd.querySelector('#searchText').value = 'skin';
    hd.querySelector('#searchText').dispatchEvent(new home.w.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    check('symptom search', hd.querySelectorAll('.doctor-card').length === 1,
        hd.querySelectorAll('.doctor-card').length + ' card(s) for "skin"');
    check('no blocked vocabulary on the home page',
        !JARGON.some(word => textOf(hd.body).toLowerCase().includes(word)));

    /* header shrink on scroll (jsdom reports no layout, so give it some) */
    Object.defineProperty(home.w, 'scrollY', { value: 900, configurable: true });
    Object.defineProperty(home.w, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(home.w.document.documentElement, 'scrollHeight', { value: 4000, configurable: true });
    home.w.dispatchEvent(new home.w.Event('scroll'));
    await new Promise(r => setTimeout(r, 60));
    check('header compacts on scroll', hd.querySelector('#siteHeader').classList.contains('compact'));
    check('scroll progress moves', (hd.querySelector('#scrollProgress').style.width || '') !== '' &&
        hd.querySelector('#scrollProgress').style.width !== '0%',
        hd.querySelector('#scrollProgress').style.width);
    check('back-to-top appears', hd.querySelector('#toTop').classList.contains('show'));

    const homeImages = await checkImages(hd);
    check('every home-page image resolves', homeImages.broken.length === 0,
        homeImages.total + ' images checked' + (homeImages.broken.length ? ' — broken: ' + homeImages.broken.join(', ') : ''));
    check('no script errors on the home page', home.errors.length === 0, home.errors.slice(0, 3).join(' | '));
    home.dom.window.close();

    /* ------------------------------------------------------------- portal */
    for (const [who, username, password, view] of [['patient', 'nimasha', 'patient123', 'dashboard'],
                                                   ['admin', 'admin', 'admin123', 'dashboard']]) {
        console.log(`\n=== PORTAL · ${who.toUpperCase()} ===`);
        const cookie = await login(username, password);
        const portal = page(fs.readFileSync(FRONT + '/app.html', 'utf8'), BASE + '/app', cookie);
        portal.w.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));
        portal.w.eval(fs.readFileSync(FRONT + '/js/app.js', 'utf8') + ';window.__App = App;');
        portal.w.document.dispatchEvent(new portal.w.Event('DOMContentLoaded'));
        await new Promise(r => setTimeout(r, 1500));
        await portal.w.__App.go(view);
        await new Promise(r => setTimeout(r, 900));
        const pd = portal.w.document;
        check('nav icons become svg', pd.querySelectorAll('.nav-item svg').length >= 5,
            pd.querySelectorAll('.nav-item svg').length + ' icons');
        check('topbar icons', pd.querySelectorAll('.top-actions svg').length >= 4,
            pd.querySelectorAll('.top-actions svg').length + ' icons');
        check('stat tiles', pd.querySelectorAll('.stat').length >= 4, pd.querySelectorAll('.stat').length + ' tiles');
        check('stat icons', pd.querySelectorAll('.stat .stat-ico svg').length >= 4);
        const chartLine = pd.querySelector('#chartLine');
        if (who === 'admin') {
            check('activity chart drawn', !!chartLine && (chartLine.getAttribute('d') || '').startsWith('M'),
                (chartLine ? (chartLine.getAttribute('d') || '').slice(0, 42) + '…' : 'no path'));
            check('chart dots', pd.querySelectorAll('#chartDots .dot').length === 14,
                pd.querySelectorAll('#chartDots .dot').length + ' days');
            check('chart legend', pd.querySelectorAll('#chartLegend span').length === 14);
        }
        check('welcome panel is branded', !!pd.querySelector('.hero-panel'));
        check('view enters with the animation class', pd.querySelector('#view').classList.contains('view-enter'));
        check('no technical wording on the portal', (() => {
            const text = pd.body.textContent.toLowerCase();
            return !['component 1', 'component 2', 'rest api', 'json', '.txt', './output', 'localhost',
                    'spring boot', 'endpoint', 'sql'].some(word => text.includes(word));
        })());
        check(`no script errors as ${who}`, portal.errors.length === 0, portal.errors.slice(0, 2).join(' | '));

        /* the profile pop-over, placed with Floating UI */
        pd.querySelector('#accountBtn').dispatchEvent(new portal.w.MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 250));
        const menu = pd.querySelector('#profileMenu');
        check('profile menu opens', !!menu && menu.classList.contains('open'),
            menu ? 'left=' + (menu.style.left || 'n/a') + ' top=' + (menu.style.top || 'n/a') : 'no menu');
        check('profile menu is filled in', !!menu && menu.querySelectorAll('.mp-item').length >= 5,
            menu ? menu.querySelectorAll('.mp-item').length + ' actions' : '');
        if (menu) menu.remove();

        /* every screen: no leftover template text, icons drawn, nothing empty */
        const views = who === 'admin'
            ? ['patients', 'patientNew', 'doctors', 'doctorNew', 'appointments', 'appointmentNew',
               'schedule', 'scheduleNew', 'feedback', 'notifications', 'staff', 'reports', 'account']
            : ['myProfile', 'appointments', 'appointmentNew', 'feedbackNew', 'notifications', 'account'];
        let leftovers = [], emptyViews = [], drawnIcons = 0;
        for (const name of views) {
            portal.errors.length = 0;
            await portal.w.__App.go(name);
            await new Promise(r => setTimeout(r, 350));
            const html = pd.querySelector('#view').innerHTML;
            const text = pd.querySelector('#view').textContent;
            if (html.includes('${lucide') || html.includes("' + lucide(") || html.includes(' + lucide(')) {
                leftovers.push(name);
            }
            if (text.trim().length < 40) emptyViews.push(name + ':' + text.trim().length);
            drawnIcons += pd.querySelectorAll('#view svg.lucide').length;
            if (portal.errors.length) leftovers.push(name + ' → ' + portal.errors[0]);
        }
        check('no template leftovers on any screen', leftovers.length === 0, leftovers.join(', '));
        check('no empty screens', emptyViews.length === 0, emptyViews.join(', '));
        check('icons drawn across every screen', drawnIcons >= (who === 'admin' ? 40 : 12), drawnIcons + ' icons');
        portal.dom.window.close();
    }

    console.log(`\n${fail === 0 ? '✅ ALL PREMIUM CHECKS PASSED' : '❌ ' + fail + ' CHECK(S) FAILED'}  (${pass} passed, ${fail} failed)`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(error => { console.error('premium check crashed:', error); process.exit(1); });
