/* ============================================================
   CASE STUDY — CONTENTS RAIL
   ------------------------------------------------------------
   Builds a fixed section index in the left gutter of a case
   study from any element carrying data-toc="Label".

   Markup lives here rather than in the HTML so every case study
   stays a single source of truth: label a section once, and the
   rail, its anchor id and the scroll-spy all follow.

   Deliberately independent of GSAP. The spy reads live rects on
   scroll instead of caching offsets, so it stays correct through
   the pinned sections (.pz-decisions / .pzu-problems), which
   change the document height while they're active.
   ============================================================ */
(function () {
  'use strict';

  const targets = Array.from(document.querySelectorAll('[data-toc]'));
  if (targets.length < 3) return;   // too few sections to be worth a rail

  const NAV_OFFSET  = 96;    // nav height + breathing room, for click-to-scroll
  const ACTIVE_LINE = 0.38;  // a section becomes current once its top crosses this much of the viewport

  const slug = (s) => s.toLowerCase().replace(/&/g, ' and ')
                       .replace(/[^a-z0-9]+/g, '-')
                       .replace(/^-+|-+$/g, '');

  targets.forEach((el, i) => {
    if (!el.id) el.id = 'sec-' + (slug(el.dataset.toc) || i);
  });

  /* ─── Build ─── */
  const rail = document.createElement('nav');
  rail.className = 'cs-toc';
  rail.setAttribute('aria-label', 'Contents');

  const list = document.createElement('ul');
  list.className = 'cs-toc__list';

  const links = targets.map((el) => {
    const li = document.createElement('li');
    li.className = 'cs-toc__item';

    const a = document.createElement('a');
    a.className = 'cs-toc__link';
    a.href = '#' + el.id;
    // The visible label is a nested span that collapses to nothing on
    // narrow gutters, so name the link explicitly for assistive tech.
    a.setAttribute('aria-label', el.dataset.toc);

    const tick = document.createElement('span');
    tick.className = 'cs-toc__tick';
    tick.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'cs-toc__label';
    label.textContent = el.dataset.toc;

    a.append(tick, label);
    li.appendChild(a);
    list.appendChild(li);
    return a;
  });

  rail.appendChild(list);

  // Mount inside the content panel, not on <body>: the rail is a
  // sticky element in a zero-width absolute column, so it enters
  // with the panel and leaves with it instead of being faded in
  // and out over a page it isn't part of.
  // The host has to span the page, not the text column — the rail
  // hangs off its left edge and would sit on top of a narrow one.
  const host = document.querySelector('[data-toc-host]')
            || document.querySelector('.pz-panel')
            || document.querySelector('main');
  if (!host) return;

  host.classList.add('cs-toc-host');

  const col = document.createElement('div');
  col.className = 'cs-toc-col';
  col.appendChild(rail);
  host.appendChild(col);

  // Place the rail by measuring, not by guessing from the viewport:
  // how much room is left of the copy decides whether the labels fit,
  // whether it drops to tick marks, or whether there's no room at all.
  // WIDE_W / SNUG_W mirror the widths in style.css.
  const WIDE_W = 178;
  const SNUG_W = 44;

  function placeRail() {
    // Measure against the unreserved layout: the band the rail claims
    // shifts the content, which would otherwise feed back into the
    // gutter this reads and let the rail walk right on every resize.
    host.style.setProperty('--cs-toc-space', '0px');

    const gutter = targets[0].getBoundingClientRect().left
                 - host.getBoundingClientRect().left;

    const snug = gutter < WIDE_W + 36;
    const off  = gutter < SNUG_W + 20;
    const w    = snug ? SNUG_W : WIDE_W;

    col.classList.toggle('is-off', off);
    rail.classList.toggle('cs-toc--snug', snug);

    if (off) return;

    // Centred in the gutter, but kept near the edge on very wide
    // screens so it stays a margin note rather than a second column.
    const inset = Math.min(96, Math.max(16, Math.round((gutter - w) / 2)));
    rail.style.marginLeft = inset + 'px';

    // Everything right of the rail is the content's to centre in.
    host.style.setProperty('--cs-toc-space', (inset + w) + 'px');

    // Vertically centred once stuck, never up under the nav.
    rail.style.top = Math.max(132, Math.round((window.innerHeight - rail.offsetHeight) / 2)) + 'px';
  }

  placeRail();

  /* ─── Click → scroll ───────────────────────────────────────
     Hand-rolled rather than behavior:'smooth' on purpose. The
     pinned sections add and remove pin spacing as they activate,
     so the document height moves while the page is travelling —
     native smooth scroll locks onto the distance it measured at
     the start and lands short. This re-reads the destination
     every frame instead, and bails the moment the user takes
     the wheel back.
     ─────────────────────────────────────────────────────────── */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animId = null;

  function stopScroll() {
    if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
  }

  ['wheel', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, stopScroll, { passive: true });
  });

  function scrollToEl(el) {
    stopScroll();

    const destOf = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
      return Math.max(0, Math.min(y, max));
    };

    if (reduced.matches) { window.scrollTo(0, destOf()); return; }

    const from = window.scrollY;
    const dur  = Math.min(1000, Math.max(480, Math.abs(destOf() - from) * 0.14));
    let t0 = null;

    const step = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, from + (destOf() - from) * e);
      animId = p < 1 ? requestAnimationFrame(step) : null;
    };

    animId = requestAnimationFrame(step);
  }

  rail.addEventListener('click', (e) => {
    const a = e.target.closest('.cs-toc__link');
    if (!a) return;
    const el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    scrollToEl(el);
  });

  /* ─── Scroll spy + show/hide ─── */
  let active = -1;
  let queued = false;

  function update() {
    queued = false;

    const line = window.innerHeight * ACTIVE_LINE;

    // Current section = the last one whose top has crossed the line.
    let next = 0;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top <= line) next = i;
    }

    if (next !== active) {
      if (links[active]) links[active].removeAttribute('aria-current');
      links[next].setAttribute('aria-current', 'true');
      active = next;
    }
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { placeRail(); onScroll(); });
  window.addEventListener('load', () => { placeRail(); onScroll(); });
  update();
})();
