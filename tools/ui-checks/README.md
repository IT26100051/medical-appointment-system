# Automated interface checks

Small Node scripts that drive the real front-end files with **jsdom** and talk to the running
application, so the parts of the marking guide that say "checked in a browser engine" can be
re-run by the examiner.

```bash
cd tools/ui-checks
npm install jsdom                     # once
node features.js                      # 29 checks - sign-in page, doctor profile card, visit us,
                                      #             check-in code, chart tooltip, human dates
node premiumcheck.js                  # 49 checks - clinic home page + the portal as patient and admin
node round3.js                        # 37 checks - the header button on hover, the clinic documents
                                      #             being the administrator's alone (and every file on the
                                      #             page opening and downloading), the search boxes, the
                                      #             booking pickers, steady movement
node waitlist.js                      # 50 checks - the waiting list end to end (--read-only: 31)
node safety.js [address]              # 24 checks - who may see what, awkward requests, hostile text
node audit.js                         # 49 checks - static audit: no internet, no coding words on screen
node signin.js                        # 25 checks - the sign-in page on its own
node uitest.js                        # every screen of every role, one line each
node bookflow.js                      # a patient, the front desk and a walk-in book a visit
node homecheck.js                     # home page counts and the patient portal at a glance
node cssparse.js                      # stylesheet parses cleanly, every media block reaches the end
node iconnames.js                     # every icon name used by the pages exists in the bundle
```

Start the application first (`java -jar backend/target/medical-appointment-system-1.0.0.jar`) — the
scripts read pages from `frontend/` and call `http://localhost:8080` for live data.

> The numbers in `docs/TEST-EVIDENCE.md` (section 9) come from these runs.

### Real browser interactions

`interaction-browser.js` adds 35 Chromium/API checks for label visibility, keyboard
pickers, typo fallback and administrator-only documents (including refresh).

```bash
npm install playwright
npx playwright install --with-deps chromium
node interaction-browser.js
```

The regular scripts use jsdom (DOM simulation), not a full rendering browser.
`bookflow.js` now fails unless the exact newly booked reference appears in the table.

`node signin-hover-browser.js` runs 24 real Chromium sign-in visibility/navigation
checks across desktop, tablet and phone widths. It checks the label itself, its bounds,
foreground hit-testing and repeated hover/focus states. Browser downloads were removed
for workspace space; reinstall Chromium before running this suite.

`node screenshot-regressions.js`: 19 read-only Chromium checks for picker photos,
light-table action visibility, absence of the known security fixture, and appointment
control layout. Requires the same Playwright/Chromium installation above.

**Do not run mutation audits on the preview.** `safety.js` refuses port 8080;
use a disposable clinic instance (for example, port 8099 with an in-memory database).
