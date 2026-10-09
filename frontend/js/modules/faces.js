/* =============================================================================
   MedCare front end - faces and default pictures
   -----------------------------------------------------------------------------
   Every person in the clinic is shown with a round photograph.  This module
   builds that mark in one place, so the side bar, the tables, the profiles and
   the sign-in page all show exactly the same face, always cropped the same way.

   The rules are:
     * if the person has a photograph (their own upload, or one from the clinic
       library) it is shown, cropped from the middle;
     * if there is none, the clinic's *default face* is shown instead - never an
       empty circle and never a broken picture;
     * if even that cannot load, neat initials are drawn in the brand colour.

   Nothing here talks to the server: the server already sends the address of the
   right picture with every record (see User.getPhotoUrl on the back end).
   ========================================================================== */

const AVATAR_COLOURS = ['#2C8078', '#5DAE4F', '#2b6cb0', '#b7791f', '#805ad5', '#c05621'];

/** The default face used when a record arrives without any picture at all. */
export const DEFAULT_FACE = 'img/people/default-avatar.svg';

function initialsOf(fullName) {
    const name = (fullName || '?').trim();
    const letters = name.split(/\s+/).map(word => word[0]).filter(Boolean).slice(0, 2).join('');
    return (letters || '?').toUpperCase();
}

function colourOf(fullName) {
    const name = (fullName || '?').trim();
    return AVATAR_COLOURS[(name.length + (name.charCodeAt(0) || 0)) % AVATAR_COLOURS.length];
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Makes sure a record that arrives with nothing at all still gets a face. */
function pictureOf(photoUrl) {
    if (!photoUrl) {
        return DEFAULT_FACE;
    }
    const clean = String(photoUrl).trim();
    if (!clean) {
        return DEFAULT_FACE;
    }
    return clean.startsWith('/') || clean.startsWith('http') ? clean : '/' + clean;
}

/**
 * A round photograph.
 *
 * @param {string} photoUrl  address sent by the server (may be missing)
 * @param {string} fullName  used for the alternative text and the initials
 * @param {number} size      side of the circle in pixels
 * @param {object} options   { fill: true }  - stretch to the container instead
 *                           of using a fixed size (side bar, top bar)
 */
export function avatar(photoUrl, fullName, size, options = {}) {
    const px = size || 38;
    const style = options.fill
        ? 'width:100%;height:100%'
        : `width:${px}px;height:${px}px;flex:0 0 ${px}px`;
    const fill = options.fill ? ' avatar-fill' : '';
    const initials = escapeHtml(initialsOf(fullName));
    const name = escapeHtml(fullName || '');
    const initialsBadge = (hidden) =>
        `<span class="avatar-init${fill}" style="${style};background:${colourOf(fullName)}${hidden ? ';display:none' : ''}">${initials}</span>`;

    // A picture that cannot be loaded silently gives way to the initials, so no
    // screen is ever left with a broken picture mark.
    return `<img class="avatar-img${fill}" style="${style}" src="${escapeHtml(pictureOf(photoUrl))}" alt="${name}"
                onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline-grid'">${initialsBadge(true)}`;
}

/** Name + face in one table cell. */
export function personCell(photoUrl, title, subtitle, size) {
    return `<div class="person-cell">${avatar(photoUrl, title, size || 38)}
            <div><span class="cell-strong">${escapeHtml(title)}</span>
            <span class="cell-sub">${escapeHtml(subtitle || '')}</span></div></div>`;
}

/** The face inside a fixed round container (side bar, top bar, booking summary). */
export function avatarInto(container, photoUrl, fullName) {
    if (!container) {
        return;
    }
    container.innerHTML = avatar(photoUrl, fullName, 0, { fill: true });
}

export { escapeHtml };
