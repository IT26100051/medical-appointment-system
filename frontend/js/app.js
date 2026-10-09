/* =============================================================================
   Medical Appointment Scheduling System - front-end application
   Talks to the clinic service and renders every page of the portal.
   ========================================================================== */

const App = (() => {

    /* ----------------------------------------------------------------- state */
    let me = null;                 // logged in user (from /api/auth/me)
    let currentView = 'dashboard';
    let notificationTimer = null;

    /* ------------------------------------------------------------ utilities */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    /* ------------------------------------------------- premium motion glue
       Motion, Lenis, Swiper and Lucide arrive as one small bundle (see
       js/vendor.entry.js).  Every call goes through the guards below, so the
       portal keeps working even if a library could not be loaded.          */
    const MedCare = window.MedCare || {};
    const EASE = [.16, 1, .3, 1];
    /* the search box and the searchable picker come from the same bundle; if it
       is missing, a plain box and plain <select> still do the job */
    const searchKit = (MedCare.search && typeof MedCare.search.searchBox === 'function')
        ? MedCare.search : null;
    const searchBox = (options = {}) => searchKit
        ? searchKit.searchBox(options)
        : `<div class="search-bar"><input id="${options.id || 'search'}" placeholder="${options.placeholder || 'Search'}"></div>`;
    const bindSearch = (root, options = {}) => searchKit ? searchKit.bindSearch(root, options) : null;
    const enhanceSelect = (select, options = {}) => searchKit ? searchKit.enhanceSelect(select, options) : null;

    const canAnimate = typeof MedCare.animate === 'function';
    const canStagger = typeof MedCare.stagger === 'function';

    function anim(targets, keyframes, options) {
        if (!canAnimate || !targets) return;
        const list = Array.isArray(targets) ? targets.filter(Boolean) : targets;
        if (Array.isArray(list) && !list.length) return;
        try { MedCare.animate(list, keyframes, options); } catch (error) { /* animation is decoration */ }
    }

    /** <i data-lucide="bell"> becomes a crisp SVG icon. */
    const lucide = (name, cls) => `<i data-lucide="${name}" class="${cls || 'ico-18'}"></i>`;

    function drawIcons(root) {
        if (typeof MedCare.createIcons !== 'function' || !MedCare.icons) return;
        try {
            MedCare.createIcons({ icons: MedCare.icons, attrs: { 'stroke-width': 1.9 }, root: root || document });
        } catch (error) { /* icons are decoration, never a reason to fail */ }
    }

    const dayjs = MedCare.dayjs || null;
    const QRCode = MedCare.QRCode || null;

    const calm = () => {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (error) { return false; }
    };

    /** "Today", "Tomorrow", "2 hours ago" - the way people actually say dates. */
    function fmtRelative(value) {
        if (!value || !dayjs) return '';
        const day = dayjs(value);
        if (!day.isValid()) return '';
        if (day.isToday()) return 'Today';
        if (day.isTomorrow()) return 'Tomorrow';
        if (day.isYesterday()) return 'Yesterday';
        return day.fromNow();
    }

    /** A small chip next to a date that is coming up soon. */
    function relativeChip(value, upcoming) {
        if (!upcoming || !dayjs) return '';
        const day = dayjs(value);
        if (!day.isValid()) return '';
        const days = day.startOf('day').diff(dayjs().startOf('day'), 'day');
        if (days < 0 || days > 7) return '';
        return `<span class="rel-chip">${esc(fmtRelative(value))}</span>`;
    }

    /** The final polish every screen gets once it has been rendered. */
    function decorateView(container) {
        drawIcons(container);
        container.classList.remove('view-enter');
        void container.offsetWidth;          // restart the entrance animation
        container.classList.add('view-enter');
        const fadeUp = { opacity: [0, 1], y: [16, 0] };
        anim($$('.stat', container), fadeUp,
            { duration: .5, ease: EASE, delay: canStagger ? MedCare.stagger(.05) : 0 });
        anim($$('.card', container).slice(0, 6), fadeUp,
            { duration: .5, ease: EASE, delay: canStagger ? MedCare.stagger(.04) : 0 });
        const rows = $$('table.data tbody tr', container).slice(0, 12);
        anim(rows, { opacity: [0, 1] }, { duration: .34, ease: 'linear',
            delay: canStagger ? MedCare.stagger(.02) : 0 });
        if ((window.scrollY || 0) > 6) scrollToTop();
    }

    /** A quiet placeholder while a screen fetches its data. */
    function skeletonBlock() {
        return `<div class="card card-pad">
            <div class="skel skel-title"></div>
            <div class="skel-row"><div class="skel skel-circle"></div>
                <div style="flex:1"><div class="skel skel-line"></div><div class="skel skel-line" style="width:58%"></div></div></div>
            <div class="skel-row"><div class="skel skel-circle"></div>
                <div style="flex:1"><div class="skel skel-line"></div><div class="skel skel-line" style="width:44%"></div></div></div>
            <div class="skel skel-line" style="width:76%; margin-top:18px"></div>
        </div>`;
    }

    const esc = value => (value === null || value === undefined ? '' : String(value))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const dash = value => (value === null || value === undefined || value === '') ? '<span class="muted">—</span>' : esc(value);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function fmtDate(value) {
        if (!value) return '—';
        const [y, m, d] = String(value).substring(0, 10).split('-');
        if (!y || !m || !d) return esc(value);
        return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
    }

    function fmtTime(value) {
        if (!value) return '—';
        const [h, mi] = String(value).substring(0, 5).split(':');
        const hour = Number(h);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const display = hour % 12 === 0 ? 12 : hour % 12;
        return `${display}:${mi} ${suffix}`;
    }

    function fmtDateTime(iso) {
        if (!iso) return '—';
        const [date, time] = String(iso).split('T');
        return `${fmtDate(date)} ${time ? fmtTime(time.substring(0, 5)) : ''}`.trim();
    }

    const todayISO = () => new Date().toISOString().substring(0, 10);

    function stars(rating) {
        const value = Math.round(Number(rating) || 0);
        let html = '<span class="stars">';
        for (let i = 1; i <= 5; i += 1) html += lucide('star', 'ico-16' + (i <= value ? '' : ' star-dim'));
        return html + '</span>';
    }

    const STATUS_STYLE = {
        PENDING: 'amber', CONFIRMED: 'blue', COMPLETED: 'green', CANCELLED: 'red', NO_SHOW: 'grey',
        AVAILABLE: 'green', BLOCKED: 'amber', BOOKED: 'blue',
        ACTIVE: 'green', INACTIVE: 'grey', VISIBLE: 'green', HIDDEN: 'amber',
        /* the waiting list (component 03) */
        WAITING: 'amber', OFFERED: 'blue'
    };

    const statusBadge = (status, label) =>
        `<span class="badge ${STATUS_STYLE[status] || 'grey'}">${esc(label || status)}</span>`;

    const roleBadge = role => `<span class="badge ${role === 'ADMIN' ? 'purple' : role === 'DOCTOR' ? 'blue' : role === 'RECEPTIONIST' ? 'green' : 'grey'}">${esc(role)}</span>`;

    /* ------------------------------------------------------------------ api */
    async function api(path, options = {}) {
        const config = { headers: {}, ...options };
        if (config.body && typeof config.body !== 'string') {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(config.body);
        }
        const response = await fetch('/api' + path, config);
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        let payload = null;
        const type = response.headers.get('content-type') || '';
        if (type.includes('application/json')) {
            payload = await response.json().catch(() => null);
        }
        if (!response.ok) {
            const error = new Error((payload && payload.message) || `Request failed (${response.status})`);
            error.status = response.status;
            error.fields = payload && payload.fields;
            throw error;
        }
        return payload || {};
    }

    /* --------------------------------------------------------------- toasts */
    function toast(message, kind = 'success', title = null) {
        const stack = $('#toastStack');
        const node = document.createElement('div');
        node.className = `toast ${kind}`;
        const heading = title || (kind === 'error' ? 'Something needs attention' : kind === 'warn' ? 'Heads up' : 'Done');
        const iconName = kind === 'error' ? 'circle-alert' : kind === 'warn' ? 'info' : 'circle-check';
        node.innerHTML = `
            <div class="t-ico">${lucide(iconName, 'ico-18')}</div>
            <div style="flex:1">
                <div class="t-title">${esc(heading)}</div>
                <div class="t-msg">${esc(message)}</div>
            </div>
            <button class="close" title="Dismiss">${lucide('x', 'ico-16')}</button>`;
        $('.close', node).onclick = () => node.remove();
        stack.appendChild(node);
        drawIcons(node);
        anim(node, { opacity: [0, 1], x: [26, 0], scale: [.96, 1] }, { duration: .42, ease: EASE });
        setTimeout(() => { node.style.transition = 'opacity .3s'; node.style.opacity = '0'; setTimeout(() => node.remove(), 320); }, 5200);
    }

    const fail = (error, form = null) => {
        toast(error.message || String(error), 'error');
        markFieldErrors(error, form);
    };

    /* ------------------------------------------------- server field errors */
    function markFieldErrors(error, form) {
        if (!form || !error.fields) return;
        clearFieldErrors(form);
        let first = null;
        Object.entries(error.fields).forEach(([name, message]) => {
            const input = form.querySelector(`[name="${name}"]`);
            if (!input) return;
            input.classList.add('input-error');
            const field = input.closest('.field');
            if (field) {
                const note = document.createElement('div');
                note.className = 'field-error-text';
                note.textContent = message;
                field.appendChild(note);
            }
            input.addEventListener('input', () => clearFieldErrors(form), { once: true });
            if (!first) first = input;
        });
        if (first) {
            first.focus({ preventScroll: true });
            first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    function clearFieldErrors(form) {
        if (!form) return;
        $$('.input-error', form).forEach(node => node.classList.remove('input-error'));
        $$('.field-error-text', form).forEach(node => node.remove());
    }

    /* -------------------------------------------------------- animations */
    function attachGlobalRipple() {
        document.addEventListener('click', event => {
            const button = event.target.closest('.btn');
            if (!button || button.disabled) return;
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
            button.appendChild(ripple);
            setTimeout(() => ripple.remove(), 640);
        }, true);
    }

    function attachPasswordToggles() {
        document.addEventListener('click', event => {
            const toggle = event.target.closest('.pwd-toggle');
            if (!toggle) return;
            const input = toggle.closest('.pwd-wrap')?.querySelector('input');
            if (!input) return;
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            toggle.innerHTML = lucide(showing ? 'eye' : 'eye-off', 'ico-16');
            toggle.title = showing ? 'Show the password' : 'Hide the password';
            drawIcons(toggle);
            input.focus();
        });
    }

    /** Counts dashboard numbers up from zero - feels alive without being slow. */
    function animateCounters(root) {
        $$('.stat .value', root).forEach(node => {
            const raw = (node.textContent || '').trim();
            if (!/^-?[\d,]*\d(\.\d+)?\s*%?$/.test(raw)) return;
            const decimals = (raw.split('.')[1] || '').replace(/[^\d]/g, '').length;
            const target = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
            if (!isFinite(target) || target === 0) return;
            const suffix = raw.includes('%') ? '%' : '';
            const started = performance.now();
            const step = now => {
                const t = Math.min(1, (now - started) / 680);
                const eased = 1 - Math.pow(1 - t, 3);
                const value = target * eased;
                node.textContent = (decimals ? value.toFixed(decimals) : Math.round(value)) + suffix;
                if (t < 1) requestAnimationFrame(step); else node.textContent = raw;
            };
            requestAnimationFrame(step);
        });
    }

    function hideSplash() {
        const splash = $('#splash');
        if (!splash) return;
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 620);
    }

    /* -------------------------------------------------- mobile drawer nav */
    function setupMobileNav() {
        const sidebar = $('#sidebar');
        const toggle = $('#menuToggle');
        if (!sidebar || !toggle) return;
        let backdrop = null;
        window.closeMobileNav = () => {
            sidebar.classList.remove('open');
            if (backdrop) { backdrop.remove(); backdrop = null; }
        };
        toggle.onclick = () => {
            if (sidebar.classList.contains('open')) { window.closeMobileNav(); return; }
            sidebar.classList.add('open');
            backdrop = document.createElement('div');
            backdrop.className = 'nav-backdrop';
            backdrop.onclick = () => window.closeMobileNav();
            document.body.appendChild(backdrop);
        };
    }

    /* --------------------------------------------------------------- modals */
    /**
     * A window keeps the keyboard inside itself while it is open: Tab walks its
     * own buttons and Escape closes it, then the focus goes back to whatever was
     * under the finger before - what a person expects from a dialog.
     */
    function keepKeyboardInside(element) {
        const lib = window.MedCare || {};
        if (typeof lib.createFocusTrap !== 'function') return { deactivate() {} };
        try {
            const trap = lib.createFocusTrap(element, {
                escapeDeactivates: false,
                returnFocusOnDeactivate: true,
                clickOutsideDeactivates: false,
                allowOutsideClick: true,
                fallbackFocus: element
            });
            trap.activate();
            return trap;
        } catch (error) {
            return { deactivate() {} };
        }
    }

    function modal({ title, subtitle = '', body = '', footer = '', wide = false, onMount = null }) {
        const root = $('#modalRoot');
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" tabindex="-1">
                <div class="modal-head">
                    <div>
                        <h3>${esc(title)}</h3>
                        ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
                    </div>
                    <button class="btn btn-ghost btn-sm close" title="Close">${lucide('x', 'ico-16')}</button>
                </div>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
            </div>`;
        root.appendChild(backdrop);
        const keyboard = keepKeyboardInside(backdrop);
        const close = () => { keyboard.deactivate(); backdrop.remove(); };
        $('.close', backdrop).onclick = close;
        backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
        document.addEventListener('keydown', function onEsc(event) {
            if (event.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
        });
        if (onMount) onMount(backdrop, close);
        drawIcons(backdrop);
        anim($('.modal', backdrop), { opacity: [0, 1], y: [18, 0], scale: [.97, 1] }, { duration: .34, ease: EASE });
        return { element: backdrop, close };
    }

    function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
        modal({
            title,
            body: `<p style="margin:0 0 6px">${esc(message)}</p>`,
            footer: `<button class="btn" data-act="cancel">Cancel</button>
                     <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(confirmLabel)}</button>`,
            onMount: (backdrop, close) => {
                $('[data-act="cancel"]', backdrop).onclick = close;
                $('[data-act="ok"]', backdrop).onclick = async () => {
                    close();
                    await onConfirm();
                };
            }
        });
    }

    function promptDialog({ title, label, placeholder = '', required = true, confirmLabel = 'Save', onConfirm }) {
        modal({
            title,
            body: `<div class="field"><label>${esc(label)} ${required ? '<span class="req">*</span>' : ''}</label>
                     <textarea id="promptValue" placeholder="${esc(placeholder)}"></textarea></div>`,
            footer: `<button class="btn" data-act="cancel">Cancel</button>
                     <button class="btn btn-primary" data-act="ok">${esc(confirmLabel)}</button>`,
            onMount: (backdrop, close) => {
                $('[data-act="cancel"]', backdrop).onclick = close;
                $('[data-act="ok"]', backdrop).onclick = async () => {
                    const value = $('#promptValue', backdrop).value.trim();
                    if (required && !value) { toast('Please enter a value', 'warn'); return; }
                    close();
                    await onConfirm(value);
                };
            }
        });
    }

    /* ---------------------------------------------------------- form helper */
    function readForm(form) {
        const data = {};
        $$('input, select, textarea', form).forEach(input => {
            if (!input.name) return;
            if (input.type === 'checkbox') data[input.name] = input.checked;
            else if (input.type === 'number') data[input.name] = input.value === '' ? null : Number(input.value);
            else data[input.name] = input.value === '' ? null : input.value;
        });
        return data;
    }

    /**
     * A list of records.
     *
     * On a computer it is the familiar table. On a telephone the same rows are
     * drawn as cards, which is how modern hospital portals show lists - no
     * sideways scrolling, every field readable. The card version is hidden by
     * the stylesheet on wide screens, so both can always be in the page.
     */
    function tableBlock(columns, rows, emptyMessage = 'No records found') {
        if (!rows.length) {
            return `<div class="empty"><span class="big">${lucide('inbox', 'ico-32')}</span>${esc(emptyMessage)}</div>`;
        }
        const table = `<div class="table-wrap"><table class="data">
            <thead><tr>${columns.map(c => `<th${c.right ? ' class="right"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${columns.map(c => `<td${c.right ? ' class="right"' : ''}>${c.cell(row)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;

        const cards = `<div class="table-cards">${rows.map((row) => {
            const head = columns[0];
            const actions = columns[columns.length - 1];
            const middle = columns.slice(1, columns.length - 1)
                .filter(column => column.label)
                .map(column => `<div class="tc-row"><span>${esc(column.label)}</span>
                        <strong>${column.cell(row)}</strong></div>`).join('');
            const hasActions = actions && typeof actions.cell === 'function' && !actions.label;
            return `<div class="tc-card">
                ${head ? `<div class="tc-head">${head.cell(row)}</div>` : ''}
                ${middle}
                ${hasActions ? `<div class="tc-actions">${actions.cell(row)}</div>` : ''}
            </div>`;
        }).join('')}</div>`;

        return cards + table;
    }

    /* =====================================================================
       PEOPLE - every person in the clinic has a photograph, and every list
       shows it, the way a real hospital portal does.
       ================================================================== */
    /* The face of a person is drawn by js/modules/faces.js (bundled with the
       other libraries), so the side bar, the tables and the profiles can never
       disagree about how a picture is shown.  If the bundle is missing, a small
       built-in version is used instead and the pages still work. */
    const faces = (MedCare && MedCare.faces) || null;
    /* check-in pass, visit summary and the small visit marks (js/modules/visit.js) */
    const visit = (MedCare && MedCare.visit) || null;

    const AVATAR_COLOURS = ['#2C8078', '#5DAE4F', '#2b6cb0', '#b7791f', '#805ad5', '#c05621'];

    function avatarHtml(photoUrl, fullName, size) {
        if (faces) {
            return faces.avatar(photoUrl, fullName, size);
        }
        const px = size || 38;
        const style = `width:${px}px;height:${px}px;flex:0 0 ${px}px`;
        const name = (fullName || '?').trim();
        const initials = name.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
        const colour = AVATAR_COLOURS[(name.length + name.charCodeAt(0)) % AVATAR_COLOURS.length];
        const source = photoUrl ? '/' + esc(photoUrl) : '/img/people/default-avatar.svg';
        return `<img class="avatar-img" style="${style}" src="${source}" alt="${esc(fullName || '')}"
                    onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline-grid'">
                <span class="avatar-init" style="${style};background:${colour};display:none">${esc(initials)}</span>`;
    }

    /** Name + face in one table cell. */
    function personCell(photoUrl, title, subtitle, size) {
        if (faces) {
            return faces.personCell(photoUrl, title, subtitle, size);
        }
        return `<div class="person-cell">${avatarHtml(photoUrl, title, size || 38)}
                <div><span class="cell-strong">${esc(title)}</span>
                <span class="cell-sub">${esc(subtitle || '')}</span></div></div>`;
    }

    /** Routine / urgent / follow-up mark shown beside an appointment. */
    function priorityPill(label, priority) {
        if (visit && typeof visit.priorityPill === 'function') {
            return visit.priorityPill(label, priority);
        }
        const kind = priority === 'URGENT' ? 'is-urgent' : priority === 'FOLLOW_UP' ? 'is-follow' : 'is-routine';
        return `<span class="priority-pill ${kind}">${esc(label || 'Routine')}</span>`;
    }

    /** "Today" / "Tomorrow" / "in 3 days" for the next-visit card. */
    function countdownText(daysAway) {
        if (visit && typeof visit.countdownText === 'function') {
            return visit.countdownText(daysAway);
        }
        const days = Number(daysAway);
        if (!Number.isFinite(days)) return '';
        return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
    }

    /** Fills a fixed round container (side bar, top bar) with a face that fits it exactly. */
    function fillAvatar(container, photoUrl, fullName) {
        if (!container) return;
        container.innerHTML = avatarHtml(photoUrl, fullName, 0);
        const mark = container.firstElementChild;
        if (mark) {
            mark.classList.add('avatar-fill');
            mark.style.width = mark.style.height = '';
            mark.style.flex = '';
        }
    }

    /* =====================================================================
       PROFILE PICTURES - Component 04 (Access Control)
       ---------------------------------------------------------------------
       Every account type may put its own face on its record.  The window that
       does the work (camera / file / clinic library / crop) lives in
       js/modules/photo-picker.js; the small block below is what the profile
       pages show, and it falls back to a simple choice list if the bundle ever
       fails to load.
       ================================================================== */

    /**
     * The token of an appointment, drawn the way a hospital slip looks.
     * The number comes from the clinic queue; nothing is worked out here.
     */
    function tokenChip(appointment, cls) {
        if (!appointment || appointment.token === null || appointment.token === undefined) return '';
        const urgent = appointment.priority === 'URGENT';
        const title = appointment.tokenNote
            ? esc(appointment.tokenNote)
            : 'Token ' + appointment.token + ' for this clinic' + (appointment.waitingAhead
                ? ' - ' + appointment.waitingAhead + ' patients ahead' : '');
        return `<span class="token-chip ${cls || ''}${urgent ? ' is-urgent' : ''}" title="${title}">
                    ${lucide('ticket', 'ico-14')} Token ${appointment.token}
                </span>`;
    }

    /** The big face plus the small camera button shown on a profile page. */
    function photoBlockHtml(person, options = {}) {
        const label = options.label || 'Profile picture';
        const name = options.name || person.fullName;
        /* A person may always change their own picture; the administrator may
           also change anybody's. Everybody else simply sees the picture, so no
           page ever offers a button that would be refused. */
        const editable = options.editable !== undefined
            ? options.editable
            : (person.id === me.id || me.role === 'ADMIN');
        const camera = editable
            ? `<button class="ph-camera" type="button" data-photo-open
                       title="Change this picture" aria-label="Change this picture">
                   ${lucide('camera', 'ico-18')}
               </button>`
            : '';
        const actions = editable
            ? `<div class="ph-actions">
                   <button class="btn btn-sm" type="button" data-photo-open>
                       ${lucide('image-plus', 'ico-16')} Change picture
                   </button>
                   <button class="btn btn-sm btn-ghost" type="button" data-photo-remove>
                       ${lucide('undo-2', 'ico-16')} Use the default
                   </button>
               </div>`
            : '';
        const hint = options.hint || (editable
            ? 'A picture of your own face helps the clinic recognise you at the desk.'
            : 'This picture was set by the clinic and cannot be changed from here.');
        return `
            <div class="ph-block">
                <div class="ph-face">
                    <div class="avatar-lg face-zoom">${avatarHtml(person.photo, name, 118)}</div>
                    ${camera}
                </div>
                <div class="ph-name">
                    <div class="small muted" style="letter-spacing:.06em; text-transform:uppercase; font-size:11.5px">${esc(label)}</div>
                    <h2 style="margin:2px 0 0">${esc(name)}</h2>
                    <div class="ph-role" data-photo-role>${esc(options.role || '')}</div>
                    ${actions}
                    <div class="ph-hint" data-photo-hint>${esc(hint)}</div>
                </div>
            </div>`;
    }

    /** Wires the buttons of the block above once the page has been drawn. */
    function attachPhotoBlock(container, person, options = {}) {
        const editable = options.editable !== undefined
            ? options.editable
            : (person.id === me.id || me.role === 'ADMIN');
        if (!editable) {
            return;
        }
        const open = container.querySelectorAll('[data-photo-open]');
        const remove = container.querySelector('[data-photo-remove]');
        const refresh = () => {
            if (options.onSaved) options.onSaved();
            else go(currentView);
        };
        open.forEach(button => button.addEventListener('click', () => openPhotoWindow(person, refresh)));
        if (remove) {
            remove.addEventListener('click', async () => {
                try {
                    const result = await api(`/photos/${person.id}`, { method: 'DELETE' });
                    toast(result.message || 'The default picture is shown again');
                    if (options.onSaved) {
                        options.onSaved(result.user || {});
                    } else {
                        go(currentView);
                    }
                } catch (error) {
                    toast(error.message || 'The picture could not be removed', 'error');
                }
            });
        }
    }

    /** Opens the picture window (from the module when it is available). */
    function openPhotoWindow(person, onSaved) {
        if (MedCare && typeof MedCare.openPhotoWindow === 'function') {
            MedCare.openPhotoWindow({
                modal, api, toast, drawIcons: drawIcons, escape: esc
            }, person, (user) => {
                if (user && user.photo) {
                    const fresh = { ...person, ...user };
                    if (fresh.id === me.id) {
                        me = { ...me, photo: fresh.photo, photoDefault: fresh.photoDefault };
                        fillAvatar($('#sideAvatar'), me.photo, me.fullName);
                    }
                    if (document.querySelector('[data-photo-open]') && document.querySelector('.avatar-lg')) {
                        document.querySelector('.avatar-lg').innerHTML = avatarHtml(fresh.photo, fresh.fullName, 118);
                    }
                }
                if (onSaved) onSaved(user);
            });
            return;
        }
        openSimplePhotoPicker(person, onSaved);
    }

    /** Small built-in version, used only if the bundled window is unavailable. */
    async function openSimplePhotoPicker(person, onSaved) {
        let library = [];
        try {
            library = (await api('/photos/library')).library || [];
        } catch (error) {
            toast('The picture library could not be loaded', 'error');
            return;
        }
        const options = library.map(entry => `<option value="${esc(entry.file)}">${esc(entry.label)}</option>`).join('');
        const window_ = modal({
            title: 'Profile picture',
            subtitle: person.fullName,
            body: `<div class="field"><label>Choose a picture for this record</label>
                    <select id="simplePhoto">${options}</select></div>`,
            footer: `<button class="btn btn-ghost" data-act="cancel">Cancel</button>
                     <button class="btn btn-primary" data-act="ok">Save</button>`,
            onMount: (root) => {
                root.querySelector('[data-act="cancel"]').onclick = () => window_.close();
                root.querySelector('[data-act="ok"]').onclick = async () => {
                    try {
                        const choice = root.querySelector('#simplePhoto').value;
                        const result = await api(`/photos/${person.id}`, {
                            method: 'POST', body: { format: 'library', payload: choice }
                        });
                        toast(result.message || 'Profile picture updated');
                        window_.close();
                        if (onSaved) onSaved(result.user || {});
                    } catch (error) {
                        toast(error.message || 'The picture could not be saved', 'error');
                    }
                };
            }
        });
    }

    /* =====================================================================
       NAVIGATION
       ================================================================== */
    const MENU = [
        { group: 'Overview', items: [
            { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] }
        ]},
        { group: 'Patients', items: [
            { id: 'patientNew', label: 'Register a patient', icon: 'user-plus', roles: ['ADMIN', 'RECEPTIONIST'] },
            { id: 'patients', label: 'Patient records', icon: 'users', roles: ['ADMIN', 'RECEPTIONIST'] },
            { id: 'myProfile', label: 'My profile', icon: 'id-card', roles: ['PATIENT'] }
        ]},
        { group: 'Our doctors', items: [
            { id: 'doctorNew', label: 'Register a doctor', icon: 'briefcase-medical', roles: ['ADMIN', 'RECEPTIONIST'] },
            { id: 'doctors', label: 'Medical team', icon: 'stethoscope', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
            { id: 'doctorProfile', label: 'My profile', icon: 'id-card', roles: ['DOCTOR'] }
        ]},
        { group: 'Appointments', items: [
            { id: 'appointmentNew', label: 'Book an appointment', icon: 'calendar-plus', roles: ['ADMIN', 'RECEPTIONIST', 'PATIENT'] },
            { id: 'appointments', label: 'Appointments', icon: 'calendar-days', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
            { id: 'waitingRoom', label: 'Waiting room', icon: 'hourglass', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
            { id: 'waitlist', label: 'Waiting list', icon: 'list-ordered', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] }
        ]},
        { group: 'Consulting hours', items: [
            { id: 'scheduleNew', label: 'Add consulting hours', icon: 'calendar-clock', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
            { id: 'schedule', label: 'Weekly schedule', icon: 'clipboard-list', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] }
        ]},
        { group: 'Feedback & messages', items: [
            { id: 'feedbackNew', label: 'Leave feedback', icon: 'star', roles: ['PATIENT'] },
            { id: 'feedback', label: 'Patient feedback', icon: 'message-square-heart', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
            { id: 'notifications', label: 'Notifications', icon: 'bell', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] }
        ]},
        { group: 'Administration', items: [
            { id: 'staff', label: 'Staff accounts', icon: 'shield-check', roles: ['ADMIN'] },
            { id: 'reports', label: 'Clinic documents', icon: 'file-text', roles: ['ADMIN'] },
            { id: 'account', label: 'My account', icon: 'settings', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] }
        ]}
    ];

    const TITLES = {
        dashboard: ['Dashboard', 'What is happening in the clinic today'],
        patientNew: ['Register a patient', 'Open a new patient record'],
        patients: ['Patient records', 'Search, view and update patient details'],
        myProfile: ['My profile', 'Your personal and contact details'],
        patientProfile: ['Patient profile', 'Personal details and visit history'],
        doctorNew: ['Register a doctor', 'Add a specialist to the medical team'],
        doctors: ['Medical team', 'Our doctors, their specialities and consulting hours'],
        doctorProfile: ['My profile', 'Your professional details'],
        appointmentNew: ['Book an appointment', 'Choose a doctor and a convenient time'],
        appointments: ['Appointments', 'Every visit - upcoming and in history'],
        waitlist: ['Waiting list', 'Patients waiting for a free time with a doctor'],
        waitingRoom: ['Waiting room', 'Who is in the clinic today, and in which order'],
        scheduleNew: ['Add consulting hours', 'Open times for a doctor to be booked'],
        schedule: ['Weekly schedule', 'The consulting hours of each doctor'],
        feedbackNew: ['Leave feedback', 'Tell us how your consultation went'],
        feedback: ['Patient feedback', 'Reviews left by patients after their visit'],
        notifications: ['Notifications', 'Appointment updates and clinic messages'],
        staff: ['Staff accounts', 'Reception and administrator accounts'],
        reports: ['Clinic documents', 'A printable text file for every record in the clinic'],
        account: ['My account', 'Your sign-in details and password']
    };

    function renderNav() {
        const nav = $('#nav');
        /* the shell is drawn before the session answers; until then there is
           nothing honest to show in the menu */
        if (!me) {
            nav.innerHTML = '';
            return;
        }
        nav.innerHTML = MENU.map(group => {
            const items = group.items.filter(item => item.roles.includes(me.role));
            if (!items.length) return '';
            return `<div class="nav-group-label">${esc(group.group)}</div>` +
                items.map(item => `<div class="nav-item ${item.id === currentView ? 'active' : ''}" data-view="${item.id}">
                        <span class="ico">${lucide(item.icon)}</span><span>${esc(item.label)}</span>
                        ${item.id === 'notifications' ? '<span class="pill" id="navUnread" style="display:none">0</span>' : ''}
                    </div>`).join('');
        }).join('');

        $$('.nav-item', nav).forEach(item => {
            item.onclick = () => {
                anim(item, { scale: [.97, 1] }, { duration: .22, ease: EASE });
                go(item.dataset.view);
                if (window.closeMobileNav) window.closeMobileNav();
            };
        });
        drawIcons(nav);
    }

    /* =====================================================================
       PAGES - one file per page
       ---------------------------------------------------------------------
       Every page of the portal lives in its own file under js/views and is
       built here. Each page receives the same helpers (the api caller, the
       toast, the windows, the formatters, the faces) and one extra thing:
       "links", which lets a page open another page's window (for example the
       dashboard opening an appointment) without importing that page directly.
       ================================================================== */
    const views = {};
    const links = {
        quickBook: (...args) => views.doctors.quickBook(...args),
        openDoctorEdit: (...args) => views.doctors.openDoctorEdit(...args),
        openPatientEdit: (...args) => views.patients.openPatientEdit(...args),
        completeAppointment: (...args) => views.appointments.completeAppointment(...args),
        cancelAppointment: (...args) => views.appointments.cancelAppointment(...args),
        openAppointmentDetail: (...args) => views.appointments.openAppointmentDetail(...args),
        openFeedbackModal: (...args) => views.feedback.openFeedbackModal(...args)
    };

    const pageDeps = {
        $, $$, api, toast, esc, dash, lucide, drawIcons, anim, animateCounters, canStagger, calm, EASE, MedCare,
        modal, confirmDialog, promptDialog, readForm, tableBlock, personCell, statusBadge, roleBadge, stars,
        avatarHtml, fillAvatar, photoBlockHtml, attachPhotoBlock, openPhotoWindow, priorityPill, countdownText,
        tokenChip, visit, fmtDate, fmtTime, fmtDateTime, fmtRelative, relativeChip, todayISO, go, links,
        searchBox, bindSearch, enhanceSelect,
        fail, refreshBell, QRCode, dayjs,
        get me() { return me; },
        get currentView() { return currentView; },
        get notificationTimer() { return notificationTimer; }
    };

    const pageFiles = MedCare.views || {};
    ['dashboard', 'patients', 'doctors', 'appointments', 'waitingRoom', 'waitlist', 'availability', 'feedback', 'administration']
        .forEach((page) => {
            views[page] = typeof pageFiles[page] === 'function' ? pageFiles[page](pageDeps) : null;
        });
    const pagesReady = Object.values(views).every(Boolean);

    /* =====================================================================
       ROUTER
       ================================================================== */
    const ROUTES = {
        dashboard: (container, params) => views.dashboard.renderDashboard(container, params),
        patientNew: (container, params) => views.patients.renderPatientForm(container, params),
        patients: (container, params) => views.patients.renderPatients(container, params),
        patientProfile: (container) => views.patients.renderPatientProfile(container, me.id),
        myProfile: (container) => views.patients.renderPatientProfile(container, me.id),
        doctorNew: (container, params) => views.doctors.renderDoctorForm(container, params),
        doctors: (container, params) => views.doctors.renderDoctors(container, params),
        doctorProfile: (container) => views.doctors.renderDoctorProfile(container, me.role === 'DOCTOR' ? me.id : null),
        appointmentNew: (container, params) => views.appointments.renderAppointmentForm(container, params),
        appointments: (container, params) => views.appointments.renderAppointments(container, params),
        waitingRoom: (container, params) => views.waitingRoom.renderWaitingRoom(container, params),
        waitlist: (container, params) => views.waitlist.renderWaitlist(container, params),
        scheduleNew: (container, params) => views.availability.renderScheduleForm(container, params),
        schedule: (container, params) => views.availability.renderSchedule(container, params),
        feedbackNew: (container, params) => views.feedback.renderFeedbackForm(container, params),
        feedback: (container, params) => views.feedback.renderFeedbackList(container, params),
        notifications: (container, params) => views.feedback.renderNotifications(container, params),
        staff: (container, params) => views.administration.renderStaff(container, params),
        reports: (container, params) => views.administration.renderReports(container, params),
        account: (container, params) => views.administration.renderAccount(container, params)
    };

    /* what each page is allowed to be opened by - the menu hides the rest, but a
       typed address or an old link must be refused too */
    const VIEW_ROLES = {};
    MENU.forEach(group => group.items.forEach(item => { VIEW_ROLES[item.id] = item.roles; }));

    async function go(view, params = {}) {
        if (!me) {
            /* nothing is rendered for a visitor whose session has ended */
            window.location.href = '/login';
            return;
        }
        if (!pagesReady) {
            $('#view').innerHTML = `<div class="card card-pad"><div class="empty">
                <span class="big">${lucide('life-buoy', 'ico-32')}</span>
                The clinic portal could not start. Please ask the clinic's technical team
                to install the current version again.</div></div>`;
            return;
        }
        if (!ROUTES[view]) view = 'dashboard';
        const allowed = VIEW_ROLES[view];
        if (allowed && !allowed.includes(me.role)) {
            toast('That page belongs to another member of the clinic team', 'error');
            view = 'dashboard';
        }
        currentView = view;
        const [title, crumb] = TITLES[view] || ['MedCare', ''];
        $('#pageTitle').textContent = title;
        $('#pageCrumb').textContent = crumb;
        location.hash = '#/' + view;
        renderNav();
        const container = $('#view');
        container.innerHTML = skeletonBlock();
        try {
            await ROUTES[view](container, params);
            decorateView(container);
        } catch (error) {
            container.innerHTML = `<div class="card card-pad"><div class="empty"><span class="big">${lucide('calendar-x', 'ico-16')}</span>
                <strong>${esc(error.message)}</strong></div></div>`;
        }
    }

    /* The dashboard page - moved to js/views/dashboard.js (built into js/vendor.js) */
    /* Patient pages - moved to js/views/patients.js (built into js/vendor.js) */
    /* Doctor pages - moved to js/views/doctors.js (built into js/vendor.js) */
    /* =====================================================================
       APPOINTMENTS - APPOINTMENTS
       ================================================================== */
    /* Appointment pages - moved to js/views/appointments.js (built into js/vendor.js) */
    /* Consulting hours pages - moved to js/views/availability.js (built into js/vendor.js) */
    /* Feedback and notification pages - moved to js/views/feedback.js (built into js/vendor.js) */
    /* =====================================================================
       STAFF ACCOUNTS - STAFF, ACCOUNT, REPORTS
       ================================================================== */



    /* =====================================================================
       SHELL - bell, session, boot
       ================================================================== */
    let lastUnreadCount = null;

    async function refreshBell() {
        try {
            const data = await api('/notifications/unread-count');
            const badge = $('#bellBadge');
            const navPill = $('#navUnread');
            if (lastUnreadCount !== null && data.unreadCount > lastUnreadCount) {
                badge.classList.add('ping');
                setTimeout(() => badge.classList.remove('ping'), 3600);
            }
            lastUnreadCount = data.unreadCount;
            if (data.unreadCount > 0) {
                badge.textContent = data.unreadCount;
                badge.style.display = 'grid';
                if (navPill) { navPill.textContent = data.unreadCount; navPill.style.display = 'inline-block'; }
            } else {
                badge.style.display = 'none';
                if (navPill) navPill.style.display = 'none';
            }
        } catch (error) { /* silent - the session may have ended */ }
    }

    async function boot() {
        attachGlobalRipple();
        attachPasswordToggles();
        setupMobileNav();
        setupScrollChrome();
        setUpShortcuts();
        setUpSmoothScroll();
        drawIcons(document);
        setTimeout(hideSplash, 5000);          // never leave the splash stuck on screen
        try {
            const data = await api('/auth/me');
            me = data.user;
        } catch (error) {
            window.location.href = '/login';
            return;
        }
        $('#sideName').textContent = me.fullName;
        $('#sideRole').textContent = me.roleDisplay;
        fillAvatar($('#sideAvatar'), me.photo, me.fullName);


        $('#bellBtn').onclick = () => go('notifications');
        $('#accountBtn').onclick = toggleProfileMenu;
        $('#refreshBtn').onclick = () => {
            const button = $('#refreshBtn');
            button.classList.remove('spin-once');
            void button.offsetWidth;
            button.classList.add('spin-once');
            go(currentView);
        };
        $('#logoutBtn').onclick = async () => {
            try { await api('/auth/logout', { method: 'POST' }); } catch (error) { /* ignore */ }
            window.location.href = '/login';
        };

        const hash = (location.hash || '').replace('#/', '');
        await go(ROUTES[hash] && isAllowed(hash) ? hash : 'dashboard');
        hideSplash();
        await refreshBell();
        clearInterval(notificationTimer);
        notificationTimer = setInterval(refreshBell, 30000);
    }

    /** The little menu under "My account", placed with Floating UI. */
    function toggleProfileMenu() {
        const anchor = $('#accountBtn');
        const existing = $('#profileMenu');
        if (existing) { existing.remove(); return; }
        const floating = MedCare.floating;
        if (!floating || typeof floating.computePosition !== 'function') { go('account'); return; }

        const menu = document.createElement('div');
        menu.className = 'menu-pop';
        menu.id = 'profileMenu';
        menu.innerHTML = `
            <div class="mp-head">
                ${avatarHtml(me.photo, me.fullName, 40)}
                <div>
                    <strong>${esc(me.fullName)}</strong>
                    <span>${esc(me.roleDisplay || me.role)}</span>
                </div>
            </div>
            <button class="mp-item" data-act="photo">${lucide('camera', 'ico-16')} Change my picture</button>
            <button class="mp-item" data-act="account">${lucide('user-round', 'ico-16')} My account</button>
            <button class="mp-item" data-act="notifications">${lucide('bell', 'ico-16')} Notifications</button>
            <button class="mp-item" data-act="keys">${lucide('keyboard', 'ico-16')} Keyboard shortcuts <kbd>?</kbd></button>
            <button class="mp-item" data-act="site">${lucide('globe', 'ico-16')} Clinic website</button>
            <button class="mp-item danger" data-act="logout">${lucide('log-out', 'ico-16')} Sign out</button>`;
        document.body.appendChild(menu);
        drawIcons(menu);

        const place = () => {
            floating.computePosition(anchor, menu, {
                placement: 'bottom-end',
                middleware: [floating.offset(10), floating.flip({ padding: 12 }), floating.shift({ padding: 12 })]
            }).then(({ x, y }) => {
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
            }).catch(() => { /* it simply stays where it landed */ });
        };
        place();
        menu.classList.add('open');
        const stopAuto = floating.autoUpdate ? floating.autoUpdate(anchor, menu, place) : null;

        const close = () => {
            if (stopAuto) stopAuto();
            menu.remove();
            document.removeEventListener('click', outside, true);
            window.removeEventListener('keydown', onKey);
        };
        function outside(event) {
            if (!menu.contains(event.target) && !anchor.contains(event.target)) close();
        }
        function onKey(event) { if (event.key === 'Escape') close(); }
        setTimeout(() => document.addEventListener('click', outside, true), 0);
        window.addEventListener('keydown', onKey);

        $('[data-act="photo"]', menu).onclick = () => { close(); openPhotoWindow(me, () => go(currentView)); };
        $('[data-act="account"]', menu).onclick = () => { close(); go('account'); };
        $('[data-act="notifications"]', menu).onclick = () => { close(); go('notifications'); };
        $('[data-act="keys"]', menu).onclick = () => { close(); openShortcutSheet(); };
        $('[data-act="site"]', menu).onclick = () => { close(); window.location.href = '/'; };
        $('[data-act="logout"]', menu).onclick = async () => {
            close();
            try { await api('/auth/logout', { method: 'POST' }); } catch (error) { /* leaving anyway */ }
            window.location.href = '/login';
        };
    }

    let lenis = null;
    let lenisFrame = null;

    /**
     * Smooth wheel scrolling for the portal, when the browser allows it.
     *
     * Kept deliberately calm: it only runs on a machine with a mouse wheel,
     * it is switched off for anyone who asked for less motion, and the frame
     * loop stops itself while the tab is hidden instead of burning the battery.
     */
    function setUpSmoothScroll() {
        if (lenis || calm()) return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        try {
            if (typeof MedCare.Lenis !== 'function') return;
            lenis = new MedCare.Lenis({ duration: 0.9, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
            const step = (time) => {
                if (document.hidden) { lenisFrame = null; return; }
                lenis.raf(time);
                lenisFrame = requestAnimationFrame(step);
            };
            lenisFrame = requestAnimationFrame(step);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && !lenisFrame && lenis) lenisFrame = requestAnimationFrame(step);
            });
        } catch (error) { lenis = null; }
    }

    /* animation is paused while the tab is out of sight */
    document.addEventListener('visibilitychange', () => {
        document.documentElement.classList.toggle('tab-hidden', document.hidden);
    });

    /** Everywhere a person can jump to with the keyboard, for this role. */
    function shortcutList() {
        const wanted = [
            ['g then d', 'Dashboard', 'dashboard'],
            ['g then b', 'Book an appointment', 'appointmentNew'],
            ['g then a', 'Appointments', 'appointments'],
            ['g then p', 'Patient records', 'patients'],
            ['g then m', 'The medical team', 'doctors'],
            ['g then w', 'Waiting room', 'waitingRoom'],
            ['g then s', 'Weekly schedule', 'schedule'],
            ['g then f', 'Patient feedback', 'feedback'],
            ['g then n', 'Notifications', 'notifications'],
            ['g then c', 'Clinic documents', 'reports'],
            ['g then u', 'My account', 'account']
        ];
        return wanted
            .filter(([, , view]) => (VIEW_ROLES[view] || []).includes(me.role))
            .concat([['/', 'Jump into the search box', null], ['?', 'This list', null], ['Esc', 'Close a window', null]]);
    }

    /** A calm window listing the keyboard shortcuts, so they can be discovered. */
    function openShortcutSheet() {
        const rows = shortcutList().filter(row => row[2] !== null || row[0] === '/' || row[0] === '?' || row[0] === 'Esc');
        const table = rows.map(([keys, what]) => `
            <div class="key-row">
                <span class="key-chords">${keys.split(' then ').map(part =>
                    `<kbd>${esc(part.trim())}</kbd>`).join('<span class="key-plus">then</span>')}</span>
                <span class="key-what">${esc(what)}</span>
            </div>`).join('');
        modal({
            title: 'Keyboard shortcuts',
            subtitle: 'The clinic can be used without reaching for the mouse',
            body: `<div class="key-sheet">${table}</div>`,
            footer: '<button class="btn btn-primary" data-act="ok">Got it</button>',
            onMount: (backdrop, close) => { $('[data-act="ok"]', backdrop).onclick = close; }
        });
    }

    /**
     * Keyboard shortcuts for the portal: "g" then a letter jumps to a page.
     * Typing inside a field is never intercepted, so nothing a patient writes
     * is ever swallowed by a shortcut.
     */
    function setUpShortcuts() {
        const lib = window.MedCare || {};
        if (typeof lib.hotkeys !== 'function') return;
        const inField = (event) => {
            const target = event && event.target;
            if (!target || !target.tagName) return false;      // a shortcut fired by the library itself
            const tag = String(target.tagName).toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
        };
        const goMap = {
            d: 'dashboard', b: 'appointmentNew', a: 'appointments', p: 'patients', m: 'doctors',
            w: 'waitingRoom', s: 'schedule', f: 'feedback', n: 'notifications', c: 'reports', u: 'account'
        };
        let waitingForSecondKey = 0;

        /* "g" then a letter - the two-key jump every modern workspace has. The
           window between the two presses is short and is shown to the person, so
           nobody is left wondering whether the keyboard did anything. */
        const onSequence = (event) => {
            if (inField(event) || event.metaKey || event.ctrlKey || event.altKey) return;
            const pressed = String(event.key || '').toLowerCase();
            if (waitingForSecondKey) {
                const view = goMap[pressed];
                clearTimeout(waitingForSecondKey);
                waitingForSecondKey = 0;
                document.documentElement.classList.remove('keys-armed');
                if (!view) return;
                event.preventDefault();
                if ((VIEW_ROLES[view] || []).includes(me.role)) go(view);
                else toast('That page belongs to another member of the clinic team', 'error');
                return;
            }
            if (pressed !== 'g') return;
            clearTimeout(waitingForSecondKey);
            waitingForSecondKey = setTimeout(() => {
                waitingForSecondKey = 0;
                document.documentElement.classList.remove('keys-armed');
            }, 1600);
            document.documentElement.classList.add('keys-armed');
        };

        try {
            document.addEventListener('keydown', onSequence);
            /* one-key shortcuts are the library's job */
            lib.hotkeys('shift+/', (event) => {
                if (inField(event)) return;
                event.preventDefault();
                openShortcutSheet();
            });
        } catch (error) { /* the mouse still works */ }
    }

    function scrollToTop() {
        if (lenis) { lenis.scrollTo(0); return; }
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        catch (error) { try { window.scrollTo(0, 0); } catch (ignored) { /* nothing left to try */ } }
    }

    /** The reading-progress line and the "back to top" button. */
    function setupScrollChrome() {
        const progress = $('#scrollProgress');
        const toTop = $('#toTop');
        let queued = false;
        const paint = () => {
            queued = false;
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            if (progress) progress.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
            if (toTop) toTop.classList.toggle('show', y > 420);
        };
        const onScroll = () => {
            if (queued) return;                     // one paint per frame, never more
            queued = true;
            requestAnimationFrame(paint);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        if (toTop) toTop.onclick = scrollToTop;
    }

    function isAllowed(view) {
        const item = MENU.flatMap(g => g.items).find(i => i.id === view);
        if (!item) return ['patientProfile', 'doctorProfile'].includes(view);
        return item.roles.includes(me.role);
    }

    window.addEventListener('DOMContentLoaded', boot);

    return { go, toast, api };
})();
