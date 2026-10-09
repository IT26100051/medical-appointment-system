/* =============================================================================
   MedCare - small display helpers shared by the pages
   -----------------------------------------------------------------------------
   The clinic stores a consulting room as the person typed it ("12", "Room 12",
   "room 12"). Every page that shows it must not end up saying "Room Room 12",
   so the wording is decided in one place, here.
   ========================================================================== */

/** "Room 12" whatever shape the clinic recorded it in. */
export function roomLabel(value) {
    const room = (value === undefined || value === null ? '' : String(value)).trim();
    if (!room) return '';
    return /^room\b/i.test(room) ? room : 'Room ' + room;
}

/** "Dr. Anura Silva" - the title is added once, never twice. */
export function doctorLabel(fullName) {
    const name = (fullName || '').trim();
    if (!name) return '';
    return /^dr\.?\s/i.test(name) ? name : 'Dr. ' + name;
}

/** A telephone number the way a receptionist reads it out. */
export function phoneLabel(value) {
    const phone = (value || '').trim();
    return phone || 'No telephone number on record';
}

export default { roomLabel, doctorLabel, phoneLabel };
