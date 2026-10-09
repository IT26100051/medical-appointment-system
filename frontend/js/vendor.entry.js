/* =============================================================================
   MedCare front end - library bundle
   -----------------------------------------------------------------------------
   This is the only file in the project that imports npm packages.  Run
   "npm install" once and "npm run build" to refresh js/vendor.js, which exposes
   the libraries on window.MedCare.  The page scripts (home.js, app.js) stay
   plain readable JavaScript and simply use window.MedCare.
   ========================================================================== */
import { animate, inView, stagger, scroll, spring, cubicBezier, hover, press } from 'motion';
import Lenis from 'lenis';
import Swiper from 'swiper';
import { Autoplay, Navigation, Pagination, Keyboard, EffectCards } from 'swiper/modules';
import 'swiper/css/bundle';
import { createIcons, icons } from 'lucide';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
import autoAnimate from '@formkit/auto-animate';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import isYesterday from 'dayjs/plugin/isYesterday';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import QRCode from 'qrcode';
import Cropper from 'cropperjs';
import { createFocusTrap } from 'focus-trap';
import hotkeys from 'hotkeys-js';
import 'cropperjs/dist/cropper.css';

/* ---------------------------------------------------------------------------
   The clinic's own page modules. They are plain, readable ES modules under
   js/modules/ - bundling them here keeps the pages themselves as classic
   scripts, so the site works without a module loader and stays easy to read.
   ------------------------------------------------------------------------- */
import * as faces from './modules/faces.js';
import { openPhotoWindow } from './modules/photo-picker.js';
import { bookingDeskHtml, bindBookingDesk, openBookingDesk } from './modules/booking.js';
import { searchBox, bindSearch, enhanceSelect } from './modules/search.js';
import { waitingListInvite, openJoinWaitlist } from './modules/waitlist.js';
import { passHtml, summaryHtml, historyHtml, countdownText, priorityPill } from './modules/visit.js';
import { queueBoardHtml, bindQueueBoard, myPlaceHtml, waitText } from './modules/queue.js';

/* ---------------------------------------------------------------------------
   The pages of the portal, one file each (see js/views).
   ------------------------------------------------------------------------- */
import { dashboardView } from './views/dashboard.js';
import { patientsView } from './views/patients.js';
import { doctorsView } from './views/doctors.js';
import { appointmentsView } from './views/appointments.js';
import { waitingRoomView } from './views/waiting-room.js';
import { waitlistView } from './views/waitlist.js';
import { availabilityView } from './views/availability.js';
import { feedbackView } from './views/feedback.js';
import { administrationView } from './views/administration.js';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.extend(isYesterday);
dayjs.extend(customParseFormat);

window.MedCare = {
    /* animation */
    animate, inView, stagger, scroll, spring, cubicBezier, hover, press,
    Lenis,
    autoAnimate,
    /* carousel */
    Swiper,
    swiperModules: { Autoplay, Navigation, Pagination, Keyboard, EffectCards },
    /* icons */
    createIcons,
    icons,
    /* pop-overs */
    floating: { computePosition, offset, flip, shift, autoUpdate },
    /* dates, spoken like a person speaks them ("in 2 days", "2 hours ago") */
    dayjs,
    /* appointment check-in codes */
    QRCode,
    /* picture cropping (profile pictures) */
    Cropper,
    /* windows that keep the keyboard inside them, and keyboard shortcuts */
    createFocusTrap,
    hotkeys,
    /* the clinic's own page modules */
    faces,
    openPhotoWindow,
    bookingDeskHtml,
    bindBookingDesk,
    openBookingDesk,
    visit: { passHtml, summaryHtml, historyHtml, countdownText, priorityPill },
    queue: { queueBoardHtml, bindQueueBoard, myPlaceHtml, waitText },
    search: { searchBox, bindSearch, enhanceSelect },
    waitlist: { waitingListInvite, openJoinWaitlist },
    /* the portal's pages */
    views: {
        dashboard: dashboardView,
        patients: patientsView,
        doctors: doctorsView,
        appointments: appointmentsView,
        waitingRoom: waitingRoomView,
        waitlist: waitlistView,
        availability: availabilityView,
        feedback: feedbackView,
        administration: administrationView
    },
    version: '2.0.0'
};
