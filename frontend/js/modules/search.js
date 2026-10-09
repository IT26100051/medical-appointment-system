import { avatar } from './faces.js';
import Fuse from 'fuse.js';
/* =============================================================================
   MedCare - search
   -----------------------------------------------------------------------------
   One search box and one searchable picker, used by every page, so the clinic
   searches the same way everywhere: a rounded box with a magnifier, a clear
   cross, a keyboard hint, and (where it helps) a small count of what was found.

   The picker is a *progressive* upgrade: the page keeps its ordinary <select>
   and all of its existing logic, and this file draws a comfortable searchable
   list on top of it. Choosing an item sets the <select> and fires its usual
   change event, so nothing else in the page needs to know.

   Nothing here is required for the page to work: if this file is missing, the
   plain <select> and the plain <input> still do their job.
   ========================================================================== */

const escapeHtml = (value) => String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* =========================================================== the search box */

/**
 * The markup for a search box.
 *
 * @param {object} options { id, placeholder, label, shortcut, size, value, autofocus }
 * @returns {string} HTML
 */
export function searchBox({
    id = 'search', placeholder = 'Search…', label = 'Search', shortcut = '/', size = '', value = ''
} = {}) {
    return `
        <div class="search-box ${size ? 'is-' + size : ''}" role="search">
            <span class="sb-ico" aria-hidden="true">
                <i data-lucide="search" class="ico-16"></i>
            </span>
            <input id="${escapeHtml(id)}" class="sb-input" type="search" value="${escapeHtml(value)}"
                   placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)}"
                   autocomplete="off" spellcheck="false">
            <button class="sb-clear" type="button" hidden
                    aria-label="Clear the search"><i data-lucide="x" class="ico-14"></i></button>
            ${shortcut ? `<kbd class="sb-key" aria-hidden="true">${escapeHtml(shortcut)}</kbd>` : ''}
        </div>`;
}

/**
 * Brings a search box to life: typing is delivered after a short pause, the
 * clear cross appears when there is something to clear, Escape empties the box
 * and "/" jumps into it from anywhere on the page.
 *
 * @param {HTMLElement} root  the element that holds the search box
 * @param {object} options { id, onSearch, delay, count }
 * @returns {object} { input, clear, value(), set(value), focus(), destroy() }
 */
export function bindSearch(root, { id = 'search', onSearch = () => {}, delay = 220, count = null, shortcut = true } = {}) {
    const box = root.querySelector('.search-box') || root;
    const input = root.querySelector('#' + id) || box.querySelector('.sb-input');
    if (!input) return null;

    const clear = box.querySelector('.sb-clear');
    const countBox = count ? (root.querySelector(count) || box.parentElement.querySelector(count)) : null;
    let timer = null;

    const paint = () => {
        const filled = input.value.length > 0;
        if (clear) clear.hidden = !filled;
        box.classList.toggle('has-value', filled);
    };

    const deliver = () => {
        const value = input.value.trim();
        if (countBox) {
            const found = onSearch(value);
            if (typeof found === 'number') {
                countBox.textContent = found === 1 ? '1 match' : found + ' matches';
                countBox.hidden = !value;
            }
        } else {
            onSearch(value);
        }
    };

    input.addEventListener('input', () => {
        paint();
        clearTimeout(timer);
        timer = setTimeout(deliver, delay);
    });

    /* Enter searches at once, Escape empties the box */
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(timer);
            deliver();
        } else if (event.key === 'Escape' && input.value) {
            event.preventDefault();
            input.value = '';
            paint();
            clearTimeout(timer);
            deliver();
        }
    });

    if (clear) {
        clear.addEventListener('click', () => {
            input.value = '';
            paint();
            clearTimeout(timer);
            deliver();
            input.focus();
        });
    }

    /* "/" anywhere on the page jumps into the search box */
    const onKey = (event) => {
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
        const tag = (event.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable) return;
        if (!root.isConnected && !box.isConnected) return;
        event.preventDefault();
        input.focus();
        input.select();
    };
    if (shortcut) document.addEventListener('keydown', onKey);
    paint();

    return {
        input,
        value: () => input.value.trim(),
        set: (text) => { input.value = text || ''; paint(); deliver(); },
        focus: () => input.focus(),
        destroy: () => { if (shortcut) document.removeEventListener('keydown', onKey); }
    };
}

/* ====================================================== the searchable picker */

/**
 * Turns a plain <select> into a comfortable searchable list.
 *
 * The page keeps using the <select> exactly as before; this draws the friendly
 * face on top of it. Options are read (and re-read when the page replaces them)
 * so the page never has to call anything.
 *
 * @param {HTMLSelectElement} select
 * @param {object} options
 *   placeholder  text in the box before anything is chosen
 *   searchPlaceholder  text inside the list's own search box
 *   render(option)  -> { title, meta, photo, initials }  how one row looks
 *   onPick(value)  called after the <select> has been set and change fired
 *   allowEmpty  show the first (empty) option as a choice  (default true)
 * @returns {object} { refresh(), open(), close(), destroy() } | null
 */
export function enhanceSelect(select, {
    placeholder = 'Choose…', searchPlaceholder = 'Type to search…',
    render = null, onPick = null, allowEmpty = true, emptyLabel = null
} = {}) {
    if (!select || select.dataset.enhanced === 'yes') return null;
    select.dataset.enhanced = 'yes';
    select.classList.add('combo-native');
    /* the native list is what the page talks to; it must not be seen */
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    const wrap = document.createElement('div');
    wrap.className = 'combo';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'combo-face';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const pop = document.createElement('div');
    pop.className = 'combo-pop';
    pop.innerHTML = `
        <div class="combo-search">
            <span class="sb-ico" aria-hidden="true"><i data-lucide="search" class="ico-16"></i></span>
            <input type="text" class="combo-input" autocomplete="off" spellcheck="false"
                   placeholder="${escapeHtml(searchPlaceholder)}" aria-label="Search the list">
            <button type="button" class="sb-clear" hidden aria-label="Clear"><i data-lucide="x" class="ico-14"></i></button>
        </div>
        <div class="combo-list" role="listbox" tabindex="-1"></div>
        <div class="combo-empty" hidden>Nothing matches that search.</div>`;

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    wrap.appendChild(button);
    wrap.appendChild(pop);

    const list = pop.querySelector('.combo-list');
    const input = pop.querySelector('.combo-input');
    const clearBtn = pop.querySelector('.sb-clear');
    const empty = pop.querySelector('.combo-empty');
    const listId = (select.id || 'picker-' + Math.random().toString(36).slice(2)) + '-choices';
    list.id = listId;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    button.setAttribute('aria-controls', listId);
    wrap.addEventListener('focusout', () => {
        setTimeout(() => { if (open && !wrap.contains(document.activeElement)) close(false); }, 0);
    });
    let rows = [];
    let active = -1;
    let open = false;

    const options = () => Array.from(select.options).map((option, index) => ({
        index, value: option.value, text: option.textContent.trim(), option
    }));

    const look = (item) => {
        if (typeof render === 'function') {
            try { return render(item) || {}; } catch (error) { /* fall back to plain text */ }
        }
        return { title: item.text };
    };

    const face = (item) => {
        if (!item) return `<span class="cf-title is-placeholder">${escapeHtml(placeholder)}</span>`;
        const view = look(item);
        return `<span class="cf-face">
                    ${view.photo || view.initials ? avatar(view.photo, view.title || item.text, 38) : ''}
                    <span class="cf-text">
                        <span class="cf-title">${escapeHtml(view.title || item.text)}</span>
                        ${view.meta ? `<span class="cf-meta">${escapeHtml(view.meta)}</span>` : ''}
                    </span>
                </span>`;
    };

    const paintFace = () => {
        button.disabled = select.disabled;
        const found = options().find(item => item.value === select.value && item.value !== '');
        button.innerHTML = face(found) +
            `<span class="cf-caret" aria-hidden="true"><i data-lucide="chevron-down" class="ico-16"></i></span>`;
        button.classList.toggle('is-chosen', !!found);
        drawIcons(button);
    };

    const paintList = (filter = '') => {
        const needle = filter.trim().toLowerCase();
        const candidates = options().filter(item => !item.option.disabled && (allowEmpty || item.value !== ''));
        rows = candidates.filter(item => !needle || item.text.toLowerCase().includes(needle));
        // Keep literal matches first; tolerate a misspelling only when none match.
        if (!rows.length && needle.length >= 3) {
            rows = new Fuse(candidates.filter(item => item.value !== ''), {
                keys: ['text'], threshold: 0.3, ignoreLocation: true
            }).search(needle).map(result => result.item);
        }
        if (!rows.length && needle) {
            active = -1;
            input.removeAttribute('aria-activedescendant');
            list.innerHTML = '';
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        list.innerHTML = rows.map((item, index) => {
            const view = look(item);
            const id = select.id ? select.id + '-opt-' + index : null;
            return `<div class="combo-item${item.value === select.value ? ' is-on' : ''}"
                        role="option" data-value="${escapeHtml(item.value)}" data-index="${index}"
                        ${id ? `id="${id}"` : ''} aria-selected="${item.value === select.value}">
                        ${view.photo || view.initials ? avatar(view.photo, view.title || item.text, 38) : ''}
                        <span class="ci-text">
                            <span class="ci-title">${escapeHtml(view.title || item.text)}</span>
                            ${view.meta ? `<span class="ci-meta">${escapeHtml(view.meta)}</span>` : ''}
                        </span>
                        ${(view.tag || '')}
                    </div>`;
        }).join('');
        drawIcons(list);
        const chosen = rows.findIndex(item => item.value === select.value);
        active = chosen;
    };

    function drawIcons(scope) {
        const lib = window.MedCare || {};
        if (typeof lib.createIcons === 'function' && lib.icons) {
            try { lib.createIcons({ icons: lib.icons, attrs: { 'stroke-width': 1.9 }, nameAttr: 'data-lucide' }); }
            catch (error) { /* the icons are decoration */ }
        }
    }

    const mark = (index) => {
        active = index;
        Array.from(list.children).forEach((node, i) => node.classList.toggle('is-active', i === index));
        const node = list.children[index];
        if (node?.id) input.setAttribute('aria-activedescendant', node.id);
        else input.removeAttribute('aria-activedescendant');
        if (node && typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({ block: 'nearest' });
        }
    };

    const pick = (value) => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        paintFace();
        close();
        if (onPick) onPick(value);
    };

    open = false;
    function openList() {
        if (select.disabled) return;
        open = true;
        input.setAttribute('aria-expanded', 'true');
        wrap.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        input.value = '';
        clearBtn.hidden = true;
        paintList();
        drawIcons(pop);
        setTimeout(() => { if (open && wrap.isConnected) input.focus({ preventScroll: true }); }, 30);
    }

    function close(restoreFocus = true) {
        open = false;
        wrap.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        if (restoreFocus) button.focus({ preventScroll: true });
    }

    button.addEventListener('click', () => (open ? close() : openList()));

    input.addEventListener('input', () => {
        clearBtn.hidden = !input.value;
        paintList(input.value);
    });
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.hidden = true;
        paintList();
        input.focus();
    });

    list.addEventListener('click', (event) => {
        const item = event.target.closest('.combo-item');
        if (item) pick(item.dataset.value);
    });

    list.addEventListener('mousemove', (event) => {
        const item = event.target.closest('.combo-item');
        if (item) mark(Number(item.dataset.index));
    });

    pop.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); mark(Math.min(active + 1, rows.length - 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); mark(Math.max(active - 1, 0)); }
        else if (event.key === 'Enter') {
            event.preventDefault();
            const chosen = rows[active];
            if (chosen) pick(chosen.value);
        } else if (event.key === 'Escape') { event.preventDefault(); close(); }
        else if (event.key === 'Tab') { close(false); }
        else if (event.key === 'Home' && event.ctrlKey) { event.preventDefault(); mark(0); }
        else if (event.key === 'End' && event.ctrlKey) { event.preventDefault(); mark(rows.length - 1); }
    });

    button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) openList();
        }
    });

    const onOutside = (event) => {
        if (open && !wrap.contains(event.target)) close(false);
    };
    document.addEventListener('mousedown', onOutside);

    /* a click on a native option list is normal, but a stray change from the
       page (for example setting a value in code) must keep the face in step */
    select.addEventListener('change', paintFace);

    /* when the page replaces the options, the list follows */
    const observer = new MutationObserver(() => { paintFace(); if (open) paintList(input.value); });
    observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });

    paintFace();

    return {
        refresh: () => { paintFace(); if (open) paintList(input.value); },
        open: openList,
        close,
        wrap,
        destroy: () => {
            observer.disconnect();
            document.removeEventListener('mousedown', onOutside);
            select.classList.remove('combo-native');
            select.removeAttribute('tabindex');
            select.removeAttribute('aria-hidden');
            delete select.dataset.enhanced;
            wrap.parentNode.insertBefore(select, wrap);
            wrap.remove();
        }
    };
}

export default { searchBox, bindSearch, enhanceSelect };
