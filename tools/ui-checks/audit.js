/* =============================================================================
   Static audit of the three delivered pages
   -----------------------------------------------------------------------------
   Checks the things a marker or a patient would notice: duplicate identifiers,
   pictures that do not exist, icons that are not in the bundled set, labels
   that point at nothing, buttons inside forms without a type, missing alt text,
   left-over template text, emoji, and technical wording on a hospital page.

   Run:  node tools/ui-checks/audit.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/medical-appointment-system/frontend';
const PAGES = ['index.html', 'login.html', 'app.html'];

let pass = 0;
let fail = 0;
const problems = [];

function check(ok, label, detail) {
    if (ok) { pass++; console.log('  ✅ ' + label + (detail ? ' — ' + detail : '')); }
    else { fail++; problems.push(label + (detail ? ' — ' + detail : '')); console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

/* ---------------------------------------------------------------- icon set */
const bundle = fs.readFileSync(path.join(ROOT, 'js/vendor.js'), 'utf8');
const known = new Set();
{
    /* the bundled Lucide set is exported as PascalCase keys; collect every key
       that looks like an icon name from the packed object literal */
    const names = bundle.match(/[A-Za-z][A-Za-z0-9]*\s*:\s*\(\)\s*=>/g) || [];
    names.forEach(n => known.add(n.split(':')[0].trim()));
    const quoted = bundle.match(/"(?:[a-z0-9]+-)+[a-z0-9]+"\s*:/g) || [];
    quoted.forEach(n => known.add(n.replace(/["\s:]/g, '')));
}

const icon = name => {
    if (!name) return false;
    if (known.has(name)) return true;
    const pascal = name.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
    return known.has(pascal);
};

/* ------------------------------------------------------------------- pages */
const TECH_WORDS = ['API', 'JSON', 'REST', 'localhost', 'database', 'H2', 'Spring Boot',
    'endpoint', 'frontend', 'backend', '.txt', 'console', 'npm', 'component'];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

PAGES.forEach(page => {
    console.log('\n' + page);
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const inTag = html.match(/<[^>]*>/g) || [];
    const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ');

    /* identifiers */
    const ids = (html.match(/\sid="([^"]+)"/g) || []).map(m => m.split('"')[1]);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    check(dupes.length === 0, 'no duplicate identifiers', dupes.join(', ') || 'none');

    /* pictures and fonts really exist */
    const missing = [];
    (html.match(/<img[^>]*src="([^"]+)"/g) || []).forEach(m => {
        const src = m.split('src="')[1].replace(/"$/, '');
        if (/^https?:|^data:/.test(src)) return;
        const file = path.join(ROOT, src.replace(/^\//, '').split('?')[0]);
        if (!fs.existsSync(file)) missing.push(src);
    });
    (html.match(/url\((['"]?)(\/[^)'"]+)\1\)/g) || []).forEach(m => {
        const src = m.replace(/url\((['"]?)/, '').replace(/['"]?\)$/, '');
        const file = path.join(ROOT, src.replace(/^\//, '').split('?')[0]);
        if (!fs.existsSync(file)) missing.push(src);
    });
    check(missing.length === 0, 'every picture and font on the page exists', missing.join(', ') || 'all present');

    /* stylesheet and scripts are reachable */
    const assets = [];
    (html.match(/(?:href|src)="(\/[^"]+\.(?:css|js))"/g) || []).forEach(m => {
        const src = m.split('"')[1];
        if (!fs.existsSync(path.join(ROOT, src.replace(/^\//, '')))) assets.push(src);
    });
    check(assets.length === 0, 'every stylesheet and script exists', assets.join(', ') || 'all present');

    /* icons */
    const badIcons = [];
    const dynamicIcons = [];
    (html.match(/data-lucide="([^"]+)"/g) || []).forEach(m => {
        const name = m.split('"')[1];
        if (/['"+$]/.test(name)) { dynamicIcons.push(name); return; }   // built by the page at run time
        if (!icon(name)) badIcons.push(name);
    });
    check(badIcons.length === 0, 'every icon name is in the bundled set', badIcons.join(', ') || 'all known');
    if (dynamicIcons.length) {
        /* the sign-in page swaps its eye icon in place; both must exist in the bundle */
        const wanted = ['eye', 'eye-off'].filter(n => !icon(n));
        check(wanted.length === 0, 'the icons the page swaps in exist too',
            wanted.length ? wanted.join(', ') : 'eye, eye-off present');
    }

    /* labels and alt text */
    const labelsFor = (html.match(/<label[^>]*for="([^"]+)"/g) || []).map(m => m.split('for="')[1].replace('"', ''));
    const danglingLabels = labelsFor.filter(id => !ids.includes(id));
    check(danglingLabels.length === 0, 'no label points at a missing field', danglingLabels.join(', ') || 'none');

    const inputs = (html.match(/<(?:input|select|textarea)[^>]*id="([^"]+)"[^>]*>/g) || []);
    const unlabelled = inputs.filter(tag => {
        const id = tag.match(/id="([^"]+)"/)[1];
        const type = (tag.match(/type="([^"]+)"/) || [])[1] || '';
        if (['hidden', 'checkbox', 'submit', 'button', 'file'].includes(type)) return false;
        return !labelsFor.includes(id) && !/aria-label=/.test(tag);
    }).map(tag => tag.match(/id="([^"]+)"/)[1]);
    check(unlabelled.length === 0, 'every field has a label', unlabelled.join(', ') || 'all labelled');

    const noAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/g) || []);
    check(noAlt.length === 0, 'every picture has alt text', noAlt.length ? noAlt.length + ' without alt' : 'all have alt');

    /* buttons inside forms declare their type */
    const formBlocks = html.match(/<form[\s\S]*?<\/form>/g) || [];
    const typed = [];
    formBlocks.forEach(block => {
        (block.match(/<button(?![^>]*type=)[^>]*>/g) || []).forEach(b => typed.push(b.slice(0, 40)));
    });
    check(typed.length === 0, 'every button inside a form has a type', typed.join(' | ') || 'all typed');

    /* template text, emoji, technical wording */
    check(!/\$\{/.test(text), 'no left-over template text', /\$\{/.test(text) ? 'found ${' : 'clean');
    const emoji = text.match(EMOJI);
    check(!emoji, 'no emoji on the page', emoji ? emoji[0] : 'none');
    const words = TECH_WORDS.filter(w => new RegExp('\\b' + w.replace('.', '\\.') + '\\b').test(text));
    check(words.length === 0, 'no technical wording in the page text', words.join(', ') || 'none');

    /* the page says what it is */
    check(/<html[^>]+lang="/.test(html), 'the page declares its language');
    check(/<title>[^<]{3,}<\/title>/.test(html), 'the page has a title');
    check(/name="viewport"/.test(html), 'the page fits a telephone');
});

/* ------------------------------------------------------- the words on screen */
console.log('\nlinks and wording');
const emptyLinks = [];
PAGES.forEach(page => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    (html.match(/href="#"[^>]*>/g) || []).forEach(m => emptyLinks.push(page + ': ' + m.slice(0, 60)));
});
check(emptyLinks.length === 0, 'no link leads nowhere', emptyLinks.join(' | ') || 'every link goes somewhere');

/* ------------------------------------------------------------- the whole css */
console.log('\nstylesheet');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
check(css.split('{').length === css.split('}').length, 'braces balance');
const cssUrls = (css.match(/url\(([^)]+)\)/g) || [])
    .map(u => u.replace(/url\((['"]?)/, '').replace(/['"]?\)$/, ''))
    .filter(u => u.startsWith('/'));
const missingCss = cssUrls.filter(u => !fs.existsSync(path.join(ROOT, u.replace(/^\//, ''))));
check(missingCss.length === 0, 'every picture the stylesheet asks for exists', missingCss.join(', ') || 'all present');
const webFonts = (css.match(/url\((['"]?)\/fonts\//g) || []).length;
check(webFonts === 0, 'fonts are loaded from the font stylesheet only', webFonts + ' in styles.css');

const defined = new Set((css.match(/(--[a-z0-9-]+)\s*:/g) || []).map(v => v.replace(/[\s:]/g, '')));
const used = new Set((css.match(/var\((--[a-z0-9-]+)/g) || []).map(v => v.replace('var(', '')));
const undefinedVars = [...used].filter(v => !defined.has(v));
check(undefinedVars.length === 0, 'every colour and size the stylesheet asks for is defined',
    undefinedVars.join(', ') || used.size + ' variables, all defined');

/* --------------------------------------------------------- nothing external */
console.log('\noffline');
const external = [];
['index.html', 'login.html', 'app.html', 'js/home.js', 'css/styles.css'].forEach(file => {
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    (body.match(/(?:src|href)="(https?:\/\/[^"]+)"/g) || []).forEach(m => external.push(file + ': ' + m));
});
check(external.length === 0, 'nothing is loaded from the internet', external.slice(0, 3).join(' | ') || 'fully offline');

console.log('\n' + (fail === 0
    ? '✅ STATIC AUDIT PASSED  (' + pass + ' checks, 0 problems)'
    : '❌ STATIC AUDIT FOUND ' + fail + ' PROBLEM(S)'));
problems.forEach(p => console.log('   • ' + p));
process.exit(fail === 0 ? 0 : 1);
