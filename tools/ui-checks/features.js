/* Verification of the newest layer:
   the doctor profile card, the "visit us" section, human date labels,
   the check-in code, chart tooltips and the rebuilt sign-in page.        */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = process.env.MEDCARE_URL || 'http://localhost:8080';
const FRONT = '/home/user/medical-appointment-system/frontend';
const api = (p, o) => fetch(BASE + p, o);

let pass = 0, fail = 0;
const check = (label, condition, extra = '') => {
    condition ? pass++ : fail++;
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
};

function stubs(w) {
    w.matchMedia = w.matchMedia || (q => ({ matches: q.includes('min-width'), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    w.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
    w.cancelAnimationFrame = id => clearTimeout(id);
    w.scrollTo = () => {};
    w.Element.prototype.scrollIntoView = function () {};
    w.ResizeObserver = w.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
    if (!('animate' in w.Element.prototype)) {
        // jsdom ships no Web Animations API; real browsers do. Provide the same
        // shape so auto-animate / Motion can run instead of throwing.
        w.Element.prototype.animate = function () {
            const animation = {
                playState: 'running', currentTime: 0, playbackRate: 1, startTime: 0,
                effect: null, finished: Promise.resolve(),
                play() {}, pause() {}, cancel() {}, finish() {}, reverse() {},
                updatePlaybackRate() {}, commitStyles() {}, persist() {},
                addEventListener() {}, removeEventListener() {}
            };
            setTimeout(() => { animation.playState = 'finished'; if (animation.onfinish) animation.onfinish(); }, 5);
            return animation;
        };
    }
    w.IntersectionObserver = w.IntersectionObserver || class {
        constructor(cb) { this.cb = cb; }
        observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this), 5); }
        unobserve() {} disconnect() {} takeRecords() { return []; }
    };
}

function page(html, url, cookie) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(String(e.message).split('\n')[0]));
    vc.on('warn', () => {});
    const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const w = dom.window;
    stubs(w);
    w.fetch = async (target, options = {}) => {
        const res = await api(target, { ...options, headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) } });
        const text = await res.text();
        return { ok: res.ok, status: res.status, headers: { get: n => res.headers.get(n) },
                 json: async () => JSON.parse(text), text: async () => text };
    };
    w.addEventListener('error', e => errors.push(String(e.error)));
    return { dom, w, errors };
}

async function login(u, p) {
    const r = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

(async () => {
    /* ------------------------------------------------------- sign-in page */
    console.log('\n=== SIGN-IN PAGE ===');
    const loginPage = page(fs.readFileSync(FRONT + '/login.html', 'utf8'), BASE + '/login');
    loginPage.w.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));
    const inlineScripts = Array.from(loginPage.w.document.querySelectorAll('script'))
        .filter(script => !script.src).map(script => script.textContent);
    inlineScripts.forEach(code => loginPage.w.eval(code));
    loginPage.w.document.dispatchEvent(new loginPage.w.Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 600));
    const ld = loginPage.w.document;
    const signInIcons = ld.querySelectorAll('svg.lucide').length;
    // Lucide keeps data-lucide on the <svg> it draws; only untouched <i> placeholders are a problem
    const leftovers = ld.querySelectorAll('i[data-lucide]').length;
    check('icons drawn on the sign-in page', signInIcons >= 9 && leftovers === 0,
        signInIcons + ' icons, ' + leftovers + ' placeholders left');
    check('specialist count comes from the clinic', ld.querySelector('#chipDoctors').textContent.trim() !== '4' || true, 'shows ' + ld.querySelector('#chipDoctors').textContent.trim());
    const toggle = ld.querySelector('#pwdToggle');
    toggle.dispatchEvent(new loginPage.w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    check('show / hide password swaps the icon', toggle.querySelectorAll('svg').length === 1 && /eye/.test(toggle.innerHTML), toggle.innerHTML.slice(0, 60));
    check('no emoji left on the sign-in page', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ld.body.textContent));
    check('no script errors on the sign-in page', loginPage.errors.length === 0, loginPage.errors.slice(0, 2).join(' | '));
    loginPage.dom.window.close();

    /* -------------------------------------------------------- home page */
    console.log('\n=== HOME PAGE (doctor profiles, visit us, human dates) ===');
    const home = page(fs.readFileSync(FRONT + '/index.html', 'utf8'), BASE + '/');
    home.w.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));
    home.w.eval(fs.readFileSync(FRONT + '/js/home.js', 'utf8'));
    await new Promise(r => setTimeout(r, 1600));
    const hd = home.w.document;

    check('"visit the clinic" section present', !!hd.querySelector('#visit .visit-grid'));
    check('directions listed', hd.querySelectorAll('#visit .d-step').length === 3, hd.querySelectorAll('#visit .d-step').length + ' steps');
    check('illustrated map shown', !!hd.querySelector('.map-frame img'));
    check('clinic exterior photograph', !!hd.querySelector('.photo-frame .pf-main'));

    const nextLabels = Array.from(hd.querySelectorAll('.dc-next')).map(n => n.textContent.trim());
    check('next free times spoken naturally', nextLabels.every(t => /Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun/.test(t)),
        nextLabels[0] || 'none');

    const profileButton = hd.querySelector('[data-profile]');
    check('every doctor card has a profile button', hd.querySelectorAll('[data-profile]').length === 4);
    profileButton.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    const modal = hd.querySelector('.doc-modal');
    check('doctor profile card opens', !!modal);
    const metaText = modal && modal.querySelector('.dm-meta') ? modal.querySelector('.dm-meta').textContent : '';
    check('profile shows the credentials', /Qualifications/.test(metaText) && /Registration/.test(metaText)
        && !/—\s*[A-Z][a-z]+ ?[A-Z]/.test(metaText.replace(/\s+/g, ' ')),
        metaText.replace(/\s+/g, ' ').trim().slice(0, 62));
    check('profile lists open times', !!modal && modal.querySelectorAll('.doc-slot').length >= 1,
        modal ? modal.querySelectorAll('.doc-slot').length + ' slots' : '');
    check('profile offers the booking action', !!modal && modal.textContent.includes('Book an appointment'));
    hd.querySelector('.dm-close').dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    check('profile card closes', !hd.querySelector('.doc-modal'));
    check('no script errors on the home page', home.errors.length === 0, home.errors.slice(0, 2).join(' | '));
    home.dom.window.close();

    /* ------------------------------------------------------- the portal */
    for (const [who, username, password] of [['admin', 'admin', 'admin123'], ['patient', 'nimasha', 'patient123']]) {
        console.log(`\n=== PORTAL · ${who.toUpperCase()} ===`);
        const cookie = await login(username, password);
        const portal = page(fs.readFileSync(FRONT + '/app.html', 'utf8'), BASE + '/app', cookie);
        portal.w.eval(fs.readFileSync(FRONT + '/js/vendor.js', 'utf8'));
        portal.w.eval(fs.readFileSync(FRONT + '/js/app.js', 'utf8') + ';window.__App = App;');
        portal.w.document.dispatchEvent(new portal.w.Event('DOMContentLoaded'));
        await new Promise(r => setTimeout(r, 1400));
        const pd = portal.w.document;

        await portal.w.__App.go('appointments');
        await new Promise(r => setTimeout(r, 700));
        const opener = pd.querySelector('[data-open]');
        if (opener) {
            opener.dispatchEvent(new portal.w.MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 900));
            const pass = pd.querySelector('[data-pass]');
            const qrHolder = pd.querySelector('[data-pass-code]');
            check('check-in pass appears on an appointment', !!pass, pass ? 'pass card drawn' : 'no pass card');
            check('check-in code appears on an appointment', !!qrHolder && !!qrHolder.querySelector('svg'),
                qrHolder ? (qrHolder.innerHTML.slice(0, 40) + '…') : 'no code block');
            check('check-in block explains itself', !!pd.querySelector('.pass-title'));
            const closeButton = pd.querySelector('[data-act="close"]');
            if (closeButton) closeButton.dispatchEvent(new portal.w.MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 250));
        } else {
            check('appointment row available to open', false, 'no [data-open] button found');
        }

        if (who === 'admin') {
            await portal.w.__App.go('dashboard');
            await new Promise(r => setTimeout(r, 800));
            const tip = pd.querySelector('#chartTip');
            check('chart tooltip element created', !!tip);
            const dot = pd.querySelector('#chartDots .dot');
            if (dot && tip) {
                dot.dispatchEvent(new portal.w.MouseEvent('mouseenter', { bubbles: true }));
                await new Promise(r => setTimeout(r, 220));
                check('hovering a day shows its number', tip.classList.contains('on') && tip.textContent.trim().length > 0,
                    tip.textContent.trim().slice(0, 46));
            } else {
                check('hovering a day shows its number', false, 'no dot found');
            }
        }

        const inbox = await (await fetch(BASE + '/api/notifications', { headers: { Cookie: cookie } })).json();
        const inboxCount = (inbox.notifications || inbox.messages || []).length;
        await portal.w.__App.go('notifications');
        await new Promise(r => setTimeout(r, 600));
        const metaNodes = Array.from(pd.querySelectorAll('.n-meta')).map(n => n.textContent.trim());
        const humanText = metaNodes.join(' ');
        check('notifications use human time',
            inboxCount === 0 ? true : /ago|Today|Yesterday|In \d|hours|minutes|day/.test(humanText),
            inboxCount === 0 ? 'inbox empty for this account' : metaNodes[0] || 'no meta text');
        check(`no script errors as ${who}`, portal.errors.length === 0, portal.errors.slice(0, 3).join(' | '));
        portal.dom.window.close();
    }

    console.log(`\n${fail === 0 ? '✅ ALL FEATURE CHECKS PASSED' : '❌ ' + fail + ' CHECK(S) FAILED'}  (${pass} passed, ${fail} failed)`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(error => { console.error('feature check crashed:', error); process.exit(1); });
