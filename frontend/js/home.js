/* =============================================================================
   MedCare Clinic - public home page
   -----------------------------------------------------------------------------
   The doctors, their specialities, the next free time of each one and the
   published patient reviews all come from the clinic's own appointment book.

   Libraries (bundled with esbuild into /js/vendor.js) - Motion for the
   animations, Lenis for the smooth scrolling, Swiper for the review carousel,
   Lucide for the icons.  If the bundle is missing for any reason the page still
   works: every library use goes through the safe facade below.
   ========================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------- tools */
    const M = window.MedCare || {};
    const animate = typeof M.animate === 'function' ? M.animate : () => ({ finished: Promise.resolve() });
    const inView = typeof M.inView === 'function' ? M.inView : null;
    const stagger = typeof M.stagger === 'function' ? M.stagger : (n => n);
    const scrollLink = typeof M.scroll === 'function' ? M.scroll : null;      // scroll-linked effects
    const autoAnimate = typeof M.autoAnimate === 'function' ? M.autoAnimate : null;
    const dayjs = M.dayjs || null;
    const QRCode = M.QRCode || null;

    const calm = () => {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (error) { return false; }
    };

    /* Dates the way a receptionist would say them: "Today · 9:25 am",
       "Tomorrow · 2:40 pm", "Fri 10 Oct · 9:00 am".                       */
    function humanSlot(dateIso, time) {
        if (!dateIso) return '';
        const pretty = time ? time.slice(0, 5).replace(/^0/, '') : '';
        if (!dayjs) return (pretty ? pretty + ' · ' : '') + dateIso;
        const day = dayjs(dateIso);
        const label = day.isToday() ? 'Today' : day.isTomorrow() ? 'Tomorrow' : day.format('ddd D MMM');
        return pretty ? label + ' · ' + pretty : label;
    }

    const $ = (selector, scope) => (scope || document).querySelector(selector);
    const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

    const esc = value => String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const icon = (name, cls) => `<i data-lucide="${name}" class="${cls || 'ico-18'}"></i>`;

    /** Replaces every <i data-lucide> placeholder with a real SVG. */
    function drawIcons() {
        if (typeof M.createIcons === 'function' && M.icons) {
            try {
                M.createIcons({ icons: M.icons, attrs: { 'stroke-width': 1.9 } });
            } catch (error) { /* icons are decoration - never break the page */ }
        }
    }

    document.documentElement.classList.add('js-anim');

    /* ------------------------------------------------------- entrance help */
    const EASE = [.16, 1, .3, 1];

    function revealElement(el) {
        animate(el, { opacity: [0, 1], y: [22, 0] }, { duration: .72, ease: EASE });
    }

    function setUpReveals(scope) {
        const singles = $$('.reveal, .reveal-l, .reveal-r, .reveal-s', scope || document);
        singles.forEach(el => {
            if (el.dataset.revealed) return;
            el.dataset.revealed = '1';
            if (!inView) { revealElement(el); return; }
            try { inView(el, () => revealElement(el), { amount: .18 }); }
            catch (error) { revealElement(el); }   // still shown, just without the wait
        });
    }

    /** Children of a .stagger box arrive one after another. */
    function staggerGroup(container) {
        if (!container) return;
        const kids = Array.from(container.children);
        if (!kids.length) return;
        animate(kids, { opacity: [0, 1], y: [18, 0] }, { duration: .6, ease: EASE, delay: stagger(.07) });
    }

    /** Numbers that count up when they scroll into view. */
    function countUp(el, to, options = {}) {
        const decimals = options.decimals || 0;
        const suffix = options.suffix || '';
        const duration = options.duration || 1200;
        const start = performance.now();
        const step = now => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = (to * eased).toFixed(decimals) + suffix;
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /* ------------------------------------------------------------- state --- */
    const SPECIALITY_ICONS = {
        'Cardiologist': 'heart-pulse',
        'Dermatologist': 'sparkles',
        'General Physician': 'stethoscope',
        'Paediatrician': 'baby'
    };
    const SPECIALITY_PHOTOS = {
        'Cardiologist': '/img/people/doctor-silva.jpg',
        'Dermatologist': '/img/people/doctor-fernando.jpg',
        'General Physician': '/img/people/doctor-perera.jpg',
        'Paediatrician': '/img/people/doctor-nawaz.jpg',
        'default': '/img/photos/team.jpg'
    };
    const SPECIALITY_BLURB = {
        'Cardiologist': 'Heart, blood pressure and cholesterol care, with ECG reviews and follow-up clinics.',
        'Dermatologist': 'Skin, hair and nail conditions, allergy testing and long-term treatment plans.',
        'General Physician': 'Everyday illnesses, health checks, diabetes reviews and specialist referrals.',
        'Paediatrician': 'Care for babies, children and teenagers, including growth checks and vaccinations.',
        'default': 'Consultations, diagnosis and continuing care from our medical team.'
    };
    const SYMPTOM_WORDS = {
        'Cardiologist': ['heart', 'chest', 'bp', 'blood pressure', 'cardiac', 'cholesterol', 'palpitation'],
        'Dermatologist': ['skin', 'rash', 'acne', 'hair', 'nail', 'allergy', 'eczema', 'mole'],
        'General Physician': ['fever', 'cough', 'cold', 'flu', 'checkup', 'check up', 'stomach', 'tired', 'diabetes'],
        'Paediatrician': ['child', 'children', 'baby', 'kid', 'vaccination', 'immunisation', 'growth']
    };

    let doctors = [];
    let activeSpec = '';
    let reviewSwiper = null;

    /* ------------------------------------------------------------ render --- */
    function starsHtml(rating) {
        const full = Math.round(rating || 0);
        let html = '';
        for (let i = 1; i <= 5; i += 1) {
            html += `<i data-lucide="star" class="${i <= full ? '' : 'star-dim'}"></i>`;
        }
        return html;
    }

    function doctorCard(doctor) {
        const photo = doctor.photo ? `/${esc(doctor.photo)}` : '';
        const initials = esc((doctor.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
        const face = photo
            ? `background-image:url('${photo}')`
            : 'background:linear-gradient(140deg,#2C8078,#5DAE4F)';
        const rating = doctor.rating
            ? `<span class="stars">${starsHtml(doctor.rating)}</span> ${doctor.rating}
               <span class="muted">(${doctor.reviews || 0})</span>`
            : '<span class="muted">No reviews yet</span>';
        const nextLabel = humanSlot(doctor.nextSlotDate, doctor.nextSlotTime);
        const next = nextLabel
            ? `<span class="dc-next">${icon('calendar-check', 'ico-14')} Next free: ${esc(nextLabel)}</span>`
            : `<span class="dc-next none">${icon('phone', 'ico-14')} No open times — please call the clinic</span>`;

        return `<article class="doctor-card lift" data-speciality="${esc(doctor.specialization)}"
                         data-name="${esc((doctor.name || '').toLowerCase())}">
            <div class="dc-photo" style="${face}">${photo ? '' : `<div class="dc-initials">${initials}</div>`}</div>
            <div class="dc-body">
                <h3>Dr. ${esc(doctor.name)}</h3>
                <div class="dc-role">${esc(doctor.specialization || '')}</div>
                <div class="dc-creds">${esc(doctor.qualifications || '')}${doctor.registrationNo ? ' · ' + esc(doctor.registrationNo) : ''}</div>
                <div class="dc-row">${icon('clock', 'ico-16')} ${esc(doctor.consultationMinutes || 30)} min consultation${doctor.roomNo ? ' · ' + esc(doctor.roomNo) : ''}</div>
                <div class="dc-row">${rating}${doctor.consultationFee ? ` · Rs ${esc(Math.round(doctor.consultationFee))}` : ''}</div>
                ${next}
                <div class="dc-actions">
                    <a class="btn btn-primary btn-sm" href="/login">${icon('calendar-plus', 'ico-16')} Book</a>
                    <button class="btn btn-sm" type="button" data-profile="${esc(doctor.id)}">
                        ${icon('user-round', 'ico-16')} Profile
                    </button>
                </div>
            </div>
        </article>`;
    }

    function specialityCard(specialization, count) {
        return `<a class="specialty-card reveal-s" href="#doctors" data-speciality-link="${esc(specialization)}">
            <div class="sp-photo" style="background-image:url('${SPECIALITY_PHOTOS[specialization] || SPECIALITY_PHOTOS.default}')"></div>
            <div class="sp-veil"></div>
            <div class="sp-body">
                <div class="sp-ico">${icon(SPECIALITY_ICONS[specialization] || 'activity', 'ico-20')}</div>
                <h3>${esc(specialization)}</h3>
                <p>${esc(SPECIALITY_BLURB[specialization] || SPECIALITY_BLURB.default)}</p>
                <span class="sp-count">${count} doctor${count === 1 ? '' : 's'} available</span>
            </div>
        </a>`;
    }

    function renderDoctors(list) {
        const grid = $('#doctorGrid');
        grid.innerHTML = list.map(doctorCard).join('');
        $('#noDoctors').classList.toggle('hidden', list.length > 0);
        drawIcons();
        staggerGroup(grid);
    }

    function matchesText(doctor, text) {
        if (!text) return true;
        const haystack = [doctor.name, doctor.specialization, doctor.qualifications].join(' ').toLowerCase();
        const words = SYMPTOM_WORDS[doctor.specialization] || [];
        return haystack.includes(text) || words.some(word => word.includes(text) || text.includes(word));
    }

    function applyFilters() {
        const text = $('#searchText').value.trim().toLowerCase();
        let list = doctors.filter(doctor => matchesText(doctor, text) && (!activeSpec || doctor.specialization === activeSpec));
        // A symptom search wins over a speciality filter that no longer matches,
        // so "skin" never comes back empty just because a chip is still selected.
        if (!list.length && text && activeSpec) {
            activeSpec = '';
            $$('#specChips .chip-btn').forEach(c => c.classList.toggle('active', c.dataset.spec === ''));
            const select = $('#searchSpec');
            if (select) select.value = '';
            list = doctors.filter(doctor => matchesText(doctor, text));
        }
        renderDoctors(list);
    }

    function renderChips(specialities) {
        $('#specChips').innerHTML =
            `<button type="button" class="chip-btn active" data-spec="">All specialities</button>` +
            specialities.map(s => `<button type="button" class="chip-btn" data-spec="${esc(s)}">${esc(s)}</button>`).join('');
        $$('#specChips .chip-btn').forEach(chip => chip.addEventListener('click', () => {
            activeSpec = chip.dataset.spec;
            $$('#specChips .chip-btn').forEach(c => c.classList.toggle('active', c === chip));
            animate(chip, { scale: [.92, 1] }, { duration: .28, ease: EASE });
            applyFilters();
        }));
    }

    function renderReviews(reviews) {
        const track = $('#reviewTrack');
        if (!reviews.length) {
            $('#reviewSwiper').style.display = 'none';
            return;
        }
        track.innerHTML = reviews.map(review => `
            <div class="swiper-slide">
                <article class="review-card">
                    <span class="stars">${starsHtml(review.rating)}</span>
                    <p class="quote">${esc(review.comments || '')}</p>
                    <div class="review-who">
                        ${review.patientPhoto
                            ? `<img class="avatar-img" style="width:44px;height:44px;flex:0 0 44px" src="/${esc(review.patientPhoto)}" alt="">`
                            : `<span class="avatar-init" style="width:44px;height:44px;background:#2C8078">${esc((review.patient || 'P').charAt(0))}</span>`}
                        <div>
                            <div class="r-name">${esc(review.patient)}</div>
                            <div class="r-meta">${esc(review.specialization || 'Visit')} · ${esc((review.date || '').slice(0, 10))}</div>
                        </div>
                        <div class="spacer"></div>
                        ${review.doctorPhoto
                            ? `<img class="avatar-img" style="width:36px;height:36px;flex:0 0 36px" src="/${esc(review.doctorPhoto)}" alt="">`
                            : ''}
                    </div>
                </article>
            </div>`).join('');

        if (typeof M.Swiper === 'function') {
            if (reviewSwiper) reviewSwiper.destroy(true, true);
            reviewSwiper = new M.Swiper('#reviewSwiper', {
                modules: M.swiperModules ? Object.values(M.swiperModules) : [],
                slidesPerView: 1,
                spaceBetween: 20,
                loop: reviews.length > 2,
                grabCursor: true,
                autoplay: reviews.length > 2 ? { delay: 5200, disableOnInteraction: false } : false,
                pagination: { el: '#reviewSwiper .swiper-pagination', clickable: true },
                breakpoints: {
                    760: { slidesPerView: 2 },
                    1160: { slidesPerView: 3 }
                }
            });
        }
        drawIcons();
    }

    /* ------------------------------------------------------------- data ---- */
    async function load() {
        try {
            const response = await fetch('/api/public/doctors');
            doctors = (await response.json()).doctors || [];
        } catch (error) {
            doctors = [];
        }
        renderDoctors(doctors);

        const counts = {};
        doctors.forEach(doctor => {
            const key = doctor.specialization || 'General Physician';
            counts[key] = (counts[key] || 0) + 1;
        });
        const specialities = Object.keys(counts);

        $('#specialtyGrid').innerHTML = specialities.map(s => specialityCard(s, counts[s])).join('');
        $('#footerSpecialties').innerHTML = specialities
            .map(s => `<li><a href="#doctors">${esc(s)}</a></li>`).join('');
        $('#searchSpec').innerHTML = '<option value="">All specialities</option>'
            + specialities.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
        renderChips(specialities);

        // the soonest free appointment in the clinic
        const soonest = doctors.filter(d => d.nextSlot).map(d => d.nextSlot)[0];
        $('#nextFree').textContent = soonest || 'Call the clinic';
        drawIcons();
        setUpReveals();
        staggerGroup($('#specialtyGrid'));

        // clinic numbers
        try {
            const summary = await (await fetch('/api/public/summary')).json();
            const numbers = [
                [summary.doctors || doctors.length, 0, ''],
                [summary.consultationsCompleted || 0, 0, '+'],
                [summary.openAppointments || 0, 0, '+'],
                [summary.averageRating || 0, 1, '']
            ];
            const elements = $$('.t-num');
            numbers.forEach(([value, decimals, suffix], index) => {
                const el = elements[index];
                if (!el) return;
                const run = () => countUp(el, Number(value), { decimals, suffix, duration: 1400 });
                try {
                    if (inView) inView(el, run, { amount: .6 }); else run();
                } catch (error) { run(); }
            });
            if (summary.averageRating) $('#heroRating').textContent = summary.averageRating.toFixed(1);
            $('#heroStars').innerHTML = starsHtml(summary.averageRating || 5);
            $('#heroReviews').textContent = `${summary.patientReviews || summary.consultationsCompleted || 0} patient reviews`;
        } catch (error) { /* the page works without the summary */ }

        // published patient reviews
        try {
            const reviewData = await (await fetch('/api/public/reviews')).json();
            renderReviews(reviewData.reviews || []);
        } catch (error) {
            $('#reviewSwiper').style.display = 'none';
        }

        $('#openState').textContent = clinicIsOpen() ? 'Open now — walk-ins welcome' : 'Closed now — book online any time';
        $('#year').textContent = new Date().getFullYear();
        drawIcons();
    }

    function clinicIsOpen() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours() + now.getMinutes() / 60;
        if (day === 0) return false;
        if (day === 6) return hour >= 8 && hour < 13;
        return hour >= 8 && hour < 18;
    }

    /* ------------------------------------------------ doctor profile card -- */

    function slotChips(doctor) {
        const slots = doctor.nextSlots || [];
        if (!slots.length) {
            return `<div class="dm-empty">${icon('phone', 'ico-16')}
                No open times at the moment — please call the clinic on 045 222 3344.</div>`;
        }
        return slots.map(slot => `
            <span class="doc-slot">
                ${icon('calendar-clock', 'ico-16')}
                <strong>${esc(humanSlot(slot.date, slot.time))}</strong>
                <span>${esc(slot.time)} – ${esc(slot.endsAt)}</span>
            </span>`).join('');
    }

    function openDoctorProfile(doctorId) {
        const doctor = doctors.find(d => String(d.id) === String(doctorId));
        const root = $('#modalRoot');
        if (!doctor || !root) return;

        const photo = doctor.photo
            ? `style="background-image:url('/${esc(doctor.photo)}')"`
            : 'style="background:linear-gradient(140deg,#2C8078,#5DAE4F)"';
        const rating = doctor.rating
            ? `<span class="stars">${starsHtml(doctor.rating)}</span> <strong>${doctor.rating}</strong>
               <span class="muted">from ${doctor.reviews} review${doctor.reviews === 1 ? '' : 's'}</span>`
            : '<span class="muted">No reviews yet</span>';

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="modal doc-modal" role="dialog" aria-modal="true" aria-label="Doctor profile">
                <div class="dm-cover" ${photo}>
                    <button class="dm-close" type="button" data-close aria-label="Close">
                        ${icon('x', 'ico-20')}
                    </button>
                    <div class="dm-cover-veil"></div>
                    <div class="dm-cover-text">
                        <span class="dm-spec">${esc(doctor.specialization || '')}</span>
                        <h3>Dr. ${esc(doctor.name)}</h3>
                        <div class="dm-rating">${rating}</div>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="dm-meta">
                        <div><span>${icon('graduation-cap', 'ico-16')} Qualifications</span>
                            <strong>${esc(doctor.qualifications || '—')}</strong></div>
                        <div><span>${icon('badge-check', 'ico-16')} Registration</span>
                            <strong>${esc(doctor.registrationNo || '—')}</strong></div>
                        <div><span>${icon('door-open', 'ico-16')} Consulting room</span>
                            <strong>${esc(doctor.roomNo || '—')}</strong></div>
                        <div><span>${icon('clock', 'ico-16')} Consultation</span>
                            <strong>${esc(doctor.consultationMinutes || 30)} minutes</strong></div>
                        <div><span>${icon('wallet', 'ico-16')} Fee</span>
                            <strong>${doctor.consultationFee ? 'Rs ' + esc(Math.round(doctor.consultationFee)) : '—'}</strong></div>
                        <div><span>${icon('stethoscope', 'ico-16')} Speciality</span>
                            <strong>${esc(doctor.specialization || '—')}</strong></div>
                    </div>

                    <h4 class="dm-sub">${icon('calendar-check', 'ico-18')} Next open times</h4>
                    <div class="dm-slots">${slotChips(doctor)}</div>
                    <p class="dm-note">Sign in to book any of these times — the time is held only once your
                        appointment is confirmed.</p>
                </div>

                <div class="modal-foot">
                    <a class="btn btn-primary" href="/login">
                        ${icon('calendar-plus', 'ico-16')} Book an appointment
                    </a>
                    <a class="btn" href="tel:+94452223344">${icon('phone', 'ico-16')} Call the clinic</a>
                </div>
            </div>`;

        root.appendChild(backdrop);
        drawIcons(backdrop);
        animate($('.modal', backdrop), { opacity: [0, 1], y: [22, 0], scale: [.97, 1] }, { duration: .38, ease: EASE });

        const close = () => {
            const panel = $('.modal', backdrop);
            animate(panel, { opacity: [1, 0], y: [0, 14], scale: [1, .98] }, { duration: .22, ease: EASE })
                .finished.then(() => backdrop.remove());
            document.removeEventListener('keydown', onKey);
        };
        function onKey(event) { if (event.key === 'Escape') close(); }

        $('[data-close]', backdrop).addEventListener('click', close);
        backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
        document.addEventListener('keydown', onKey);
        setTimeout(() => $('[data-close]', backdrop).focus(), 60);
    }

    /* ------------------------------------------------ scrolling effects --- */

    function setUpParallax() {
        if (!scrollLink || calm()) return;
        try {
            const hero = $('.hero-collage');
            if (hero) {
                scrollLink(progress => {
                    const shift = progress * 46;
                    const main = $('.shot.main', hero);
                    const small = $('.shot.small', hero);
                    if (main) main.style.transform = `translate3d(0, ${shift * .5}px, 0)`;
                    if (small) small.style.transform = `translate3d(0, ${-shift * .7}px, 0)`;
                }, { target: $('.hero'), offset: ['start start', 'end start'] });
            }
            const band = $('.cta-band');
            if (band) {
                scrollLink(progress => {
                    band.style.backgroundPosition = `center ${50 + (progress - .5) * 16}%`;
                }, { target: band, offset: ['start end', 'end start'] });
            }
        } catch (error) { /* the page simply stays still */ }
    }

    function setUpSmoothLists() {
        if (!autoAnimate) return;
        const grid = $('#doctorGrid');
        if (grid) {
            try { autoAnimate(grid, { duration: 260, easing: 'ease-out' }); }
            catch (error) { /* filtering is simply instant */ }
        }
    }

    /* animation is paused while the tab is out of sight */
    document.addEventListener('visibilitychange', () => {
        document.documentElement.classList.toggle('tab-hidden', document.hidden);
    });

    /* ------------------------------------------------------ interactions --- */
    function setUpChrome() {
        // smooth scrolling
        try {
            if (typeof M.Lenis === 'function' && !calm()
                && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                const lenis = new M.Lenis({ duration: 0.9, smoothWheel: true });
                let frame = null;
                const step = time => {
                    frame = null;
                    if (document.hidden) return;
                    lenis.raf(time);
                    frame = requestAnimationFrame(step);
                };
                const resume = () => {
                    if (document.hidden) {
                        if (frame !== null) cancelAnimationFrame(frame);
                        frame = null;
                    } else if (frame === null) {
                        frame = requestAnimationFrame(step);
                    }
                };
                document.addEventListener('visibilitychange', resume);
                resume();
                $$('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
                    const target = document.querySelector(link.getAttribute('href'));
                    if (!target) return;
                    event.preventDefault();
                    lenis.scrollTo(target, { offset: -80 });
                }));
            }
        } catch (error) {
            /* the browser scrolls normally instead - nothing else changes */
        }

        // header, scroll progress, back to top
        const header = $('#siteHeader');
        const progress = $('#scrollProgress');
        const toTop = $('#toTop');
        let queued = false;
        const paint = () => {
            queued = false;
            const y = window.scrollY || document.documentElement.scrollTop;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            header.classList.toggle('compact', y > 40);
            progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
            toTop.classList.toggle('show', y > 600);
        };
        const onScroll = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(paint);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        toTop.addEventListener('click', () => {
            if (window.MedCare && window.__lenis) { /* not used */ }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // announcement
        const announce = $('#announce');
        $('#announceClose').addEventListener('click', () => {
            animate(announce, { height: [announce.offsetHeight, 0], opacity: [1, 0] }, { duration: .32, ease: EASE })
                .finished.then(() => announce.remove());
        });

        // mobile drawer
        const drawer = $('#navDrawer');
        $('#navToggle').addEventListener('click', () => drawer.classList.add('open'));
        $$('[data-close]', drawer).forEach(el => el.addEventListener('click', () => drawer.classList.remove('open')));
        const syncMenuButton = () => {
            $('#navToggle').style.display = window.innerWidth <= 900 ? 'inline-flex' : 'none';
        };
        syncMenuButton();
        window.addEventListener('resize', syncMenuButton);

        // hero entrance
        animate($$('[data-hero]'), { opacity: [0, 1], y: [26, 0] },
            { duration: .8, ease: EASE, delay: stagger(.09) });

        // FAQ accordion
        $$('.faq-item').forEach(item => {
            const question = $('.faq-q', item);
            const answer = $('.faq-a', item);
            question.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                $$('.faq-item.open').forEach(other => {
                    if (other === item) return;
                    other.classList.remove('open');
                    animate($('.faq-a', other), { height: [other.querySelector('.faq-a').offsetHeight, 0] },
                        { duration: .3, ease: EASE });
                });
                if (isOpen) {
                    item.classList.remove('open');
                    animate(answer, { height: [answer.offsetHeight, 0] }, { duration: .3, ease: EASE });
                } else {
                    item.classList.add('open');
                    animate(answer, { height: [answer.offsetHeight, answer.scrollHeight] }, { duration: .34, ease: EASE })
                        .finished.then(() => { answer.style.height = 'auto'; });
                }
            });
        });

        // doctor profile cards
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-profile]');
            if (button) openDoctorProfile(button.dataset.profile);
        });

        setUpParallax();
        setUpSmoothLists();

        // search
        $('#searchForm').addEventListener('submit', event => {
            event.preventDefault();
            applyFilters();
            document.getElementById('doctors').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        $('#searchText').addEventListener('input', applyFilters);
        $('#searchSpec').addEventListener('change', () => {
            activeSpec = $('#searchSpec').value;
            $$('#specChips .chip-btn').forEach(c => c.classList.toggle('active', c.dataset.spec === activeSpec));
            applyFilters();
        });

        document.addEventListener('click', event => {
            const card = event.target.closest('[data-speciality-link]');
            if (!card) return;
            activeSpec = card.dataset.specialityLink;
            $('#searchSpec').value = activeSpec;
            $$('#specChips .chip-btn').forEach(c => c.classList.toggle('active', c.dataset.spec === activeSpec));
            applyFilters();
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') drawer.classList.remove('open');
        });
    }

    let started = false;

    function start() {
        if (started) return;
        started = true;
        setUpChrome();
        setUpReveals();
        setUpReveals($('#specialtyGrid'));
        drawIcons();
        load();
        window.addEventListener('load', drawIcons);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
