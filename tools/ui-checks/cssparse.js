const fs = require('fs');
const { JSDOM } = require('jsdom');
const css = fs.readFileSync('/home/user/medical-appointment-system/frontend/css/styles.css', 'utf8');
const dom = new JSDOM(`<style>${css}</style>`, { pretendToBeVisual: true });
const sheet = dom.window.document.styleSheets[0];
const rules = sheet.cssRules;
let media = 0, styleRules = 0;
const walk = list => { for (const r of list) { if (r.type === 4) { media++; walk(r.cssRules); } else styleRules++; } };
walk(rules);
console.log('parsed top-level rules:', rules.length, '| style rules:', styleRules, '| media blocks:', media);
const last = Array.from(rules).filter(r => r.type === 4).slice(-1)[0];
console.log('last media query:', last ? last.media.mediaText : 'none');
console.log('rules inside it:', last ? last.cssRules.length : 0);
const selectors = [];
walk2(rules); function walk2(list){ for (const r of list){ if (r.type===4) walk2(r.cssRules); else selectors.push(r.selectorText); } }
for (const s of ['.doc-modal', '.checkin-code', '.chart-tip', '.rel-chip', '.visit-grid', '.mobile-bar', '.dc-actions', '.dm-meta', '.hidden', '.star-dim']) {
  console.log(`${s.padEnd(14)} in stylesheet:`, selectors.some(x => x && x.includes(s)));
}
