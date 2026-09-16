gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
const cursor = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursorFollower');

if (cursor && cursorFollower) {
  let mouseX = 0, mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.1, ease: 'power2.out' });
    gsap.to(cursorFollower, { x: mouseX, y: mouseY, duration: 0.4, ease: 'power2.out' });
  });

  document.querySelectorAll('a, button, [data-hover]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      gsap.to(cursor, { scale: 2.5, duration: 0.25 });
      gsap.to(cursorFollower, { scale: 1.5, opacity: 0.5, duration: 0.25 });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(cursor, { scale: 1, duration: 0.25 });
      gsap.to(cursorFollower, { scale: 1, opacity: 1, duration: 0.25 });
    });
  });
}

/* ============================================================
   NAV — scroll-triggered glass background
   ============================================================ */
const nav = document.getElementById('nav');
if (nav) {
  ScrollTrigger.create({
    start: 80,
    onEnter: () => nav.classList.add('scrolled'),
    onLeaveBack: () => nav.classList.remove('scrolled'),
  });
}

// On case study pages: hide nav once past the hero, show only when back at top
if (nav && document.querySelector('main.pz')) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > window.innerHeight * 0.8) {
      gsap.to(nav, { y: '-100%', duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
    } else {
      gsap.to(nav, { y: '0%', duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    }
  }, { passive: true });
}

/* ============================================================
   MARK ACTIVE NAV LINK
   ============================================================ */
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__link').forEach((link) => {
  const href = link.getAttribute('href');
  if (href === currentPage) link.classList.add('active');
});

/* ============================================================
   HERO ANIMATIONS (index.html only)
   ============================================================ */
const heroPortrait = document.getElementById('heroPortrait');
const heroIntro = document.getElementById('heroIntro');
const heroTitle = document.getElementById('heroTitle');
const heroScroll = document.getElementById('heroScroll');
const heroScrollDot = document.getElementById('heroScrollDot');

if (heroIntro && heroTitle) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (heroPortrait) {
    tl.to(heroPortrait, { opacity: 1, duration: 0.8 }, 0)
      .fromTo(heroPortrait, { y: 20, scale: 0.92 }, { y: 0, scale: 1, duration: 0.9 }, 0);
  }

  tl.to(heroIntro, { opacity: 1, y: 0, duration: 0.8 }, 0.2)
    .fromTo(heroIntro, { y: 16 }, { y: 0, duration: 0.8 }, 0.2);

  /* The statement reveals word by word rather than as one block.
     autoSplit + onSplit is load-bearing, not decoration: Inter arrives as a
     webfont, so splitting against fallback metrics produces the wrong line
     break, and the two lines re-wrap on resize. Creating the tween *inside*
     onSplit targets the fresh word elements each time, and returning it lets
     SplitText revert and re-sync it across every re-split. */
  /* ---- Cursor-proximity weight ----------------------------------------
     Measured, not assumed (see notes below): the wght axis was the wrong
     tool for these two faces.

       Inter  is variable (wght 100-900, and the variable file is already
              what Google serves here) but the axis WIDENS glyphs —
              "designing with craft" runs 373.38px at 400 and 384.41px at
              600. 11px of drift is a reflow, not a weight change.
       PP Editorial New has no fvar table at all: six static OTFs. There is
              nothing to interpolate, and swapping files moves the same
              string from 244px to 263.7px.

     So the weight is painted instead. -webkit-text-stroke-width thickens
     the existing outline without touching metrics — measured identical
     width AND height at 0 / 0.35 / 0.7px in both faces — and
     `paint-order: stroke fill` puts the stroke behind the fill so counters
     stay open rather than filling in. The stroke colour is currentColor,
     so craft/thinking/build keep their own colours with nothing to sync.

     No tweens: a single rAF loop eases each character's current value
     toward a target derived from cursor distance. Rapid movement only ever
     rewrites the target, so there is nothing to stack or overwrite. */
  const WEIGHT_RADIUS = 140;    // px — how far the cursor's influence reaches
  /* Peak stroke as a fraction of the line's font size. Rendered side by side,
     0.55px was indistinguishable from no stroke at all on both faces; the
     effect only starts reading around 0.9px and is clearly heavy by 1.3px.
     0.030em puts the 42px statement at ~1.26px and the 32px serif at ~0.96px,
     which lands them at a similar apparent weight — a flat value makes the
     smaller serif look heavier than the italic. */
  const WEIGHT_MAX_EM = 0.055;
  /* Time constant, not a per-frame fraction. A fixed fraction per frame
     converges at whatever rate the display runs — twice as fast on a 120Hz
     panel as on 60Hz — so the smoothing is derived from elapsed ms instead
     and feels identical everywhere. ~90ms to close roughly 63% of the gap. */
  const WEIGHT_TAU    = 90;

  const weightLines = [];      // { el, chars:[{ set, x, y, cur, target }] }
  let   weightOn    = false;
  let   pointer     = { x: -9999, y: -9999 };

  /* Character centres are cached relative to their line, not the viewport:
     the hero parallax translates these elements as the cursor moves, so
     absolute positions go stale every frame. Two rect reads per frame for
     the lines beats 79 for the characters. */
  function cacheCharPositions(line) {
    const base = line.el.getBoundingClientRect();
    line.baseW = base.width || 1;
    line.chars.forEach((c) => {
      const r = c.el.getBoundingClientRect();
      c.x = r.left + r.width / 2 - base.left;
      c.y = r.top + r.height / 2 - base.top;
    });
  }

  function weightFrame(time, deltaTime) {
    let settling = false;
    /* clamped so a stalled tab resuming doesn't snap everything at once */
    const k = 1 - Math.exp(-Math.min(deltaTime || 16.7, 64) / WEIGHT_TAU);

    /* read phase — batched, so writes below never force a re-layout */
    const bases = weightLines.map((l) => l.el.getBoundingClientRect());

    weightLines.forEach((line, li) => {
      const base = bases[li];
      /* The hero pin scales #heroContent on scroll, which shrinks the line
         without moving the characters within it. Offsets were cached at the
         rest size, so rescale them by the current ratio rather than letting
         the hit-testing drift as the hero exits. */
      const k = base.width / line.baseW;

      line.chars.forEach((c) => {
        const dx = pointer.x - (base.left + c.x * k);
        const dy = pointer.y - (base.top + c.y * k);
        const d  = Math.sqrt(dx * dx + dy * dy);

        /* Smoothstep, not squared. Squared collapses too fast to see: at 40px
           it had already dropped to half, so in practice only the single
           glyph under the cursor carried any weight — and the hero parallax
           shifts the text as the cursor moves, so even that one rarely sat at
           the peak. Smoothstep holds ~80% out to 40px and still eases to
           zero at the rim, which reads as a pool of weight following the
           cursor rather than one letter flickering. */
        const t = d >= WEIGHT_RADIUS ? 0 : 1 - d / WEIGHT_RADIUS;
        c.target = t * t * (3 - 2 * t) * line.maxStroke;

        const next = c.cur + (c.target - c.cur) * k;
        if (Math.abs(next - c.cur) > 0.0015) {
          c.cur = next;
          c.set(c.cur);
          settling = true;
        } else if (c.cur !== c.target && Math.abs(c.target - c.cur) < 0.0015) {
          c.cur = c.target;
          c.set(c.cur);
        }
      });
    });

    /* Idle when everything has arrived and the cursor has left — no loop
       ticking over an inert headline. */
    if (!settling && pointer.x === -9999) {
      gsap.ticker.remove(weightFrame);
      weightOn = false;
    }
  }

  /* GSAP's ticker rather than a private requestAnimationFrame loop: one clock
     for the page means this can't tick out of step with the tweens beside it,
     and it inherits GSAP's lag smoothing after a stall. */
  function startWeightLoop() {
    if (!weightOn) { weightOn = true; gsap.ticker.add(weightFrame); }
  }

  function registerWeightLine(el, chars) {
    /* quickSetter caches the property lookup and appends the unit, so the
       per-frame write is about as cheap as a style write gets. */
    const line = {
      el,
      chars: chars.map((c) => {
        c.style.webkitTextStrokeColor = 'currentColor';
        c.style.paintOrder = 'stroke fill';
        return { el: c, set: gsap.quickSetter(c, 'webkitTextStrokeWidth', 'px'), x: 0, y: 0, cur: 0, target: 0 };
      }),
    };
    line.maxStroke = parseFloat(getComputedStyle(el).fontSize) * WEIGHT_MAX_EM;
    const existing = weightLines.findIndex((l) => l.el === el);
    if (existing >= 0) weightLines[existing] = line; else weightLines.push(line);
    cacheCharPositions(line);
  }

  if (window.SplitText && window.BN_MOTION_OK) {
    gsap.set(heroTitle, { opacity: 1 });

    /* Splitting to chars INSIDE words keeps every character within its
       .hero__hl span, so the italic and the three colours are untouched. */
    SplitText.create(heroTitle, {
      type: 'words,chars',
      autoSplit: true,
      onSplit(self) {
        registerWeightLine(heroTitle, self.chars);
        return gsap.from(self.words, {
          yPercent: 60,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.05,
          delay: 0.5,
        });
      },
    });

    SplitText.create(heroIntro, {
      type: 'chars',
      autoSplit: true,
      onSplit(self) { registerWeightLine(heroIntro, self.chars); },
    });

    const heroEl = document.getElementById('hero');
    heroEl.addEventListener('mousemove', (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      startWeightLoop();
    }, { passive: true });

    heroEl.addEventListener('mouseleave', () => {
      pointer = { x: -9999, y: -9999 };   // every target falls to 0, eased
      startWeightLoop();
    });

    /* Re-wrapping changes where the characters sit. autoSplit re-registers
       on a re-split; this covers a resize that does not force one. */
    window.addEventListener('resize', () => {
      weightLines.forEach(cacheCharPositions);
    });

    /* The statement's words enter from yPercent 60, so positions captured at
       split time are mid-flight. Re-cache once the entrance has landed. */
    gsap.delayedCall(1.6, () => weightLines.forEach(cacheCharPositions));
  } else {
    /* No plugin, or reduced motion — the original block fade. */
    tl.to(heroTitle, { opacity: 1, duration: 0.9 }, 0.5)
      .fromTo(heroTitle, { y: 32 }, { y: 0, duration: 0.9 }, 0.5);
  }

  tl.to(heroScroll, { opacity: 1, duration: 0.6 }, 1.2);

  /* Scroll dot bounce loop */
  if (heroScrollDot) {
    gsap.to(heroScrollDot, {
      y: 20,
      duration: 1,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: -1,
      delay: 1.8,
    });
  }
}

/* ============================================================
   HERO — floating-in-space hover parallax
   ============================================================ */
(function () {
  const hero     = document.getElementById('hero');
  const portrait = document.getElementById('heroPortrait');
  const intro    = document.getElementById('heroIntro');
  const title    = document.getElementById('heroTitle');
  if (!hero || !title) return;

  hero.addEventListener('mousemove', (e) => {
    const { left, top, width, height } = hero.getBoundingClientRect();
    const dx = (e.clientX - left - width  / 2) / (width  / 2);  // −1 → +1
    const dy = (e.clientY - top  - height / 2) / (height / 2);  // −1 → +1

    /* Portrait is the nearest plane of all — travels furthest */
    if (portrait) gsap.to(portrait, {
      x: dx * 34, y: dy * 20,
      duration: 0.7, ease: 'power2.out', overwrite: 'auto',
    });

    /* Intro line floats next-closest — most x/y movement of the type */
    if (intro) gsap.to(intro, {
      x: dx * 28, y: dy * 16,
      duration: 0.7, ease: 'power2.out', overwrite: 'auto',
    });

    /* Title: mid-depth + subtle 3D tilt so letters feel like they're pivoting in space */
    gsap.to(title, {
      x: dx * 16, y: dy * 9,
      rotateX: -dy * 6, rotateY: dx * 6,
      transformPerspective: 900,
      duration: 0.8, ease: 'power2.out', overwrite: 'auto',
    });

  });

  hero.addEventListener('mouseleave', () => {
    gsap.to([portrait, intro, title].filter(Boolean), {
      x: 0, y: 0, rotateX: 0, rotateY: 0,
      duration: 1.2, ease: 'power3.out', overwrite: 'auto',
    });
  });
}());

/* ============================================================
   HERO EXIT + 3D RING CAROUSEL + SCROLL-STEP CARDS
   ============================================================ */
const SLIDES = [
  { title: 'Driving 79% growth in Wallet-on-UPI adoption', tags: ['Fintech', 'UPI'], href: 'work/payzapp.html' },
  { title: 'Healthcare Systems', tags: ['Healthcare'],         href: 'work/healthcare.html' },
  { title: 'Rebuilding the UPI payments experience on PayZapp', tags: ['Fintech', 'Systems'], href: 'work/payzapp-upi.html' },
  { title: 'Project Title',      tags: ['Product Design'],     href: '#'                    },
];

const _cs  = document.getElementById('carouselSection');
const _ct  = document.getElementById('carouselTrack');
const _cdo = document.getElementById('carouselDots');
const _cpv = document.getElementById('carouselPrev');
const _cnx = document.getElementById('carouselNext');
const _ci  = document.getElementById('carouselInner');

if (_cs && _ct) {
  const N     = SLIDES.length;
  /* Ring radii scale with the card (see .c-card in style.css) — the gap
     between the front card's edge and the side cards depends on the ratio
     of these to the card width, so they move together. */
  const RX    = 377;
  const RZ    = 144;
  /* Peak yaw, in degrees, applied to a card at the far side of the ring.
     x/RX is sin(angle), so the front card sits at 0 and the turn eases in
     as a card swings out — raise this to slant the side cards further. */
  const YAW   = 76;
  /* Total pin = N+1 viewports: 1 transition + N-1 card steps + 1 exit */
  const TOTAL = N + 1;
  const TRANS = 1 / TOTAL;     // fraction used for entrance  ~0.2
  const EXIT  = N / TOTAL;     // fraction where exit begins  ~0.8

  /* Carousel inner starts at FROM values: 130px below center, tilted forward, hidden */
  gsap.set(_ci, {
    opacity: 0, scale: 0.5, rotateX: -30, y: 200,
    transformPerspective: 1000, transformOrigin: '50% 50%',
  });

  /* ---- Build cards */
  const cardEls = SLIDES.map((s) => {
    const el = document.createElement('a');
    el.className = 'c-card';
    el.href = s.href;
    /* The card is all image now, so the link has no text of its own —
       name it from the slide or it reads as an unlabelled link. */
    el.setAttribute('aria-label', `${s.title} — view case study`);
    el.innerHTML = `
      <div class="c-card__image">
        <video src="Assets/PPI%20teaser.mov" muted loop playsinline preload="none"></video>
      </div>`;
    _ct.appendChild(el);
    return el;
  });

  /* ---- Build dots */
  const dotEls = SLIDES.map((_, i) => {
    const d = document.createElement('button');
    d.className = 'carousel-dot';
    d.setAttribute('aria-label', `Slide ${i + 1}`);
    _cdo.appendChild(d);
    return d;
  });

  /* ---- 3D ring */
  let ringAngle = 0;
  let activeIdx = -1;   // -1 so the first positionRing() always runs the pass
  const angleProxy = { v: 0 };

  function positionRing(angle, instant = false) {
    const step = 360 / N;
    let bestZ = -Infinity, bestI = 0;

    cardEls.forEach((card, i) => {
      const deg = ((angle + i * step) % 360 + 360) % 360;
      const rad = deg * (Math.PI / 180);
      const x   = RX * Math.sin(rad);
      const z   = RZ * Math.cos(rad);
      const t   = (z + RZ) / (2 * RZ);
      const sc  = 0.55 + t * 0.45;
      const op  = 0.15 + t * 0.85;
      const zi  = Math.round(t * 20);
      const ry  = -(x / RX) * YAW;

      const props = { x, z, rotateY: ry, scale: sc, opacity: op, zIndex: zi, transformPerspective: 1100 };
      instant ? gsap.set(card, props) : gsap.to(card, { ...props, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });

      if (z > bestZ) { bestZ = z; bestI = i; }
    });

    if (bestI !== activeIdx) {
      activeIdx = bestI;
      dotEls.forEach((d, i) => d.classList.toggle('active', i === activeIdx));

      syncVideos();
    }
  }

  /* Only the card at the front plays. The other three are turned away from
     the viewer and mostly occluded, so decoding them is wasted work — and
     because every card shows the same file, a looping background video
     re-pulls it on each pass.
     Gated on the carousel being on screen: the ring is positioned during
     init, while the visitor is still looking at the hero, and playing then
     would pull the video down on the critical path for no visible benefit. */
  function syncVideos() {
    if (!carouselLive) return;
    cardEls.forEach((card, i) => {
      const v = card.querySelector('video');
      if (!v) return;
      if (i === activeIdx) { v.play().catch(() => {}); }
      else if (!v.paused)  { v.pause(); }
    });
  }

  function rotateTo(target) {
    while (target - ringAngle >  180) target -= 360;
    while (target - ringAngle < -180) target += 360;
    angleProxy.v = ringAngle;
    gsap.to(angleProxy, {
      v: target, duration: 0.7, ease: 'power3.out', overwrite: true,
      onUpdate: () => { ringAngle = angleProxy.v; positionRing(ringAngle); },
    });
  }

  function snapToCard(idx) { rotateTo(-idx * (360 / N)); }

  /* Pre-set perspective so it never animates (no 3D projection discontinuity on reverse) */
  gsap.set('#heroContent', { transformPerspective: 1000, transformOrigin: '50% 50%' });

  /* ---- Single hero pin: transition + card steps + exit ---- */
  let currentCardIdx = 0;
  let scrollDir = 1;
  let carouselLive = false;

  const pinTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: () => `+=${window.innerHeight * TOTAL}`,
      pin: true,
      anticipatePin: 1,
      scrub: 1,
      snap: {
        snapTo: (value) => {
          if (value < TRANS / 2) return 0;
          /* Going forward: commit to TRANS. Going backward: release straight to 0 */
          if (value < TRANS) return scrollDir > 0 ? TRANS : 0;
          if (value >= EXIT) return value;
          const step = 1 / TOTAL;
          return Math.round(value / step) * step;
        },
        duration: { min: 0.2, max: 0.5 },
        ease: 'power3.out',
        delay: 0,
      },
      onUpdate(self) {
        scrollDir = self.direction;
        const p = self.progress;

        /* Warm every card's video the first time the carousel is reached,
           not at page load — the hero is what the visitor waits for, and
           preload="none" keeps all four off the critical path until then.
           After this the side cards show real frames rather than flat
           placeholder panels, while only the front one actually plays. */
        if (!carouselLive && p > TRANS * 0.5) {
          carouselLive = true;
          cardEls.forEach((card) => {
            const v = card.querySelector('video');
            if (v && v.readyState === 0) v.load();
          });
          syncVideos();
        }
        _cs.style.pointerEvents = (p > TRANS - 0.02 && p < EXIT + 0.02) ? 'auto' : 'none';
        if (p > TRANS && p < EXIT + 0.01) {
          const cardProgress = Math.max(0, (p - TRANS) / (EXIT - TRANS));
          const idx = Math.min(N - 1, Math.round(cardProgress * (N - 1)));
          if (idx !== currentCardIdx) { currentCardIdx = idx; snapToCard(idx); }
        }
      },
      onScrubComplete(self) {
        /* When fully back at hero, guarantee a clean visual state */
        if (self.progress <= 0.01) {
          gsap.set('#heroContent', { y: 0, scale: 1, opacity: 1, rotateX: 0 });
          gsap.set('#heroScroll',  { y: 0, opacity: 1 });
        }
      },
    },
  });

  /* Phase 1 — hero exits while carousel rises from bottom of pinned screen */
  pinTl
    .to('#heroContent', { y: '-70vh', scale: 0.8, opacity: 0, rotateX: 30, transformPerspective: 1000, transformOrigin: '50% 50%', duration: 0.8, ease: 'none' }, 0)
    .to('#heroScroll',  { y: '-30vh', opacity: 0, duration: 0.6, ease: 'none' }, 0)
    .to(_ci,            { opacity: 1, scale: 1, rotateX: 0, y: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'power3.out' }, 0.15)
  /* Phase 2 — card stepping (empty, driven by onUpdate above) */
    .to({ _: 0 }, { _: 1, duration: N - 1 }, 1)
  /* Phase 3 — carousel exits like hero content */
    .to(_ci, { y: -90, scale: 0.8, opacity: 0, rotateX: 30, transformPerspective: 1000, transformOrigin: '50% 50%', duration: 0.8, ease: 'none' }, N);

  /* ---- "Work" in the nav means the carousel, not a separate page ----
     There's no element to anchor to: the carousel lives inside the pinned
     hero, so its position is a progress value within the pin rather than a
     place in the document. TRANS is where the cards have finished rising —
     the same point the pin's own snap settles to. This block only exists on
     the page that has a carousel, so the link navigates normally elsewhere. */
  function carouselScrollY() {
    const st = pinTl.scrollTrigger;
    if (!st) return 0;
    return st.start + (st.end - st.start) * TRANS;
  }

  function goToCarousel(smooth) {
    window.scrollTo({ top: carouselScrollY(), behavior: smooth ? 'smooth' : 'auto' });
  }

  /* Clicked while already here */
  document.querySelectorAll('a[href$="#work"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', '#work');
      goToCarousel(true);
    });
  });

  /* Arrived from another page — wait for the pin to be measured, or the
     offset is computed against a document that has no pin spacing yet. */
  if (location.hash === '#work') {
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
      goToCarousel(false);
    });
  }

  /* ---- Prev / Next buttons */
  _cpv?.addEventListener('click', () => snapToCard(Math.max(activeIdx - 1, 0)));
  _cnx?.addEventListener('click', () => snapToCard(Math.min(activeIdx + 1, N - 1)));

  /* ---- Click side card to bring to front */
  cardEls.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if (i !== activeIdx) { e.preventDefault(); snapToCard(i); }
    });
  });

  /* ---- Keyboard */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') snapToCard(Math.min(activeIdx + 1, N - 1));
    if (e.key === 'ArrowLeft')  snapToCard(Math.max(activeIdx - 1, 0));
  });

  positionRing(ringAngle, true);
}

/* ============================================================
   WORK PAGE — card scroll reveals
   ============================================================ */
const workCards = document.querySelectorAll('.work-card');
if (workCards.length) {
  gsap.to(workCards, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.work-grid',
      start: 'top 80%',
    },
  });
}

/* ============================================================
   PLAY PAGE — card reveals + magnetic tilt
   ============================================================ */
const playCards = document.querySelectorAll('.play-card');
if (playCards.length) {
  gsap.to(playCards, {
    opacity: 1,
    duration: 0.7,
    ease: 'power2.out',
    stagger: 0.08,
    scrollTrigger: {
      trigger: '.play-grid',
      start: 'top 80%',
    },
  });

  playCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      gsap.to(card, {
        rotateY: dx * 8,
        rotateX: -dy * 8,
        duration: 0.4,
        ease: 'power2.out',
        transformPerspective: 800,
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.6)',
      });
    });
  });
}

/* ============================================================
   PAGE HEADER reveals (works for dedicated pages AND homepage #work section)
   ============================================================ */
document.querySelectorAll('.page-header__title').forEach((el) => {
  revealOnScroll(el, { y: 40, duration: 0.9 });
});

document.querySelectorAll('.page-header__desc').forEach((el) => {
  revealOnScroll(el, { y: 24 });
});

/* ============================================================
   ABOUT PAGE — scroll reveals
   ============================================================ */
const aboutStatement = document.querySelector('.about-left__statement');
const aboutBody = document.querySelector('.about-left__body');
const aboutTimeline = document.querySelector('.about-timeline');
const aboutSkills = document.querySelector('.about-skills');
const aboutRight = document.querySelector('.about-right');

function revealOnScroll(el, options = {}) {
  if (!el) return;
  gsap.fromTo(el,
    { opacity: 0, y: options.y ?? 32 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 82%',
        ...options.scrollTrigger,
      },
    }
  );
}

revealOnScroll(aboutStatement);
revealOnScroll(aboutBody, { y: 24 });
revealOnScroll(aboutTimeline, { y: 24 });
revealOnScroll(aboutSkills, { y: 20 });
revealOnScroll(aboutRight, { y: 40 });

/* ============================================================
   CONTACT STRIP — heading + links reveals
   ============================================================ */
const contactHeading = document.querySelector('.contact-strip__heading');
const contactLinks = document.querySelector('.contact-strip__links');

revealOnScroll(contactHeading);
revealOnScroll(contactLinks, { y: 20 });

/* ============================================================
   CASE STUDY PAGE — reveals
   ============================================================ */
const caseTitle = document.querySelector('.case-hero__title');
const caseMeta = document.querySelector('.case-hero__meta');
const caseCover = document.querySelector('.case-cover');

if (caseTitle) {
  gsap.fromTo(caseTitle,
    { opacity: 0, y: 48 },
    { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.3 }
  );
}
if (caseMeta) {
  gsap.fromTo(caseMeta,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.65 }
  );
}
if (caseCover) {
  gsap.fromTo(caseCover,
    { opacity: 0 },
    { opacity: 1, duration: 1, ease: 'power2.out', delay: 0.9 }
  );
}

document.querySelectorAll('.case-section, .case-image').forEach((el) => {
  revealOnScroll(el, { y: 28 });
});

/* ============================================================
   FLOOR GRID — interactive hover glow
   Uses document-level mousemove + inverse perspective math because
   content elements sit above the floor in stacking order and would
   otherwise swallow pointer events before they reach the canvas.
   ============================================================ */
(function () {
  const floor = document.querySelector('.hero__floor');
  if (!floor) return;

  const CELL     = 25;    // matches CSS background-size: 25px 25px
  const CYCLE_MS = 1200;  // matches CSS grid-scroll animation duration
  const RADIUS   = 3;     // cell radius of glow
  const P        = 600;   // matches CSS perspective(600px)
  const SIN60    = Math.sin(Math.PI / 3); // ~0.866
  const COS60    = Math.cos(Math.PI / 3); // 0.5
  const t0       = Date.now();

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__floor-canvas';
  floor.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let floorX = 0, floorY = 0, active = false;

  // Glow colour follows the active theme (see --grid-glow-* in style.css).
  let glowRGB = '255,255,255', glowAlpha = 0.18;

  function readGlow() {
    const cs = getComputedStyle(document.documentElement);
    const rgb = cs.getPropertyValue('--grid-glow-rgb').trim();
    const a   = parseFloat(cs.getPropertyValue('--grid-glow-alpha'));
    if (rgb) glowRGB = rgb.replace(/\s+/g, '');
    if (!isNaN(a)) glowAlpha = a;
  }
  readGlow();

  // Re-read whenever the theme attribute flips.
  new MutationObserver(readGlow).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  function resize() {
    canvas.width  = floor.offsetWidth;
    canvas.height = floor.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Inverse of: transform-origin(50% 0%) + perspective(P) rotateX(60deg)
  // transform-origin maps to screen point (50vw, 50vh).
  // Forward: sx = 50vw + (lx - vw)/w,  sy = 50vh + COS60*ly/w
  //          where w = 1 - SIN60*ly/P
  // Inverse:
  //   ly  = dsy / (COS60 + dsy*SIN60/P)   (solve quadratic collapsed to linear)
  //   lx  = dsx * w + vw
  function screenToFloor(sx, sy) {
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const dsy = sy - vh * 0.5;
    const ly  = dsy / (COS60 + dsy * SIN60 / P);
    if (ly < 0) return null;                   // above the horizon
    const w = 1 - SIN60 * ly / P;
    if (w <= 0) return null;
    const lx = (sx - vw * 0.5) * w + vw;
    return { lx, ly };
  }

  document.addEventListener('mousemove', e => {
    const pt = screenToFloor(e.clientX, e.clientY);
    if (pt) { floorX = pt.lx; floorY = pt.ly; active = true; }
    else     { active = false; }
  });

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (active) {
      const yOff = ((Date.now() - t0) % CYCLE_MS) / CYCLE_MS * CELL;
      const col  = Math.floor(floorX / CELL);
      const row  = Math.floor((floorY - yOff) / CELL);

      for (let dr = -RADIUS; dr <= RADIUS; dr++) {
        for (let dc = -RADIUS; dc <= RADIUS; dc++) {
          const dist = Math.hypot(dr, dc);
          if (dist > RADIUS) continue;
          const alpha = (1 - dist / RADIUS) * glowAlpha;
          ctx.fillStyle = `rgba(${glowRGB},${alpha.toFixed(3)})`;
          ctx.fillRect(
            (col + dc) * CELL + 1,
            (row + dr) * CELL + yOff + 1,
            CELL - 2,
            CELL - 2
          );
        }
      }
    }

    requestAnimationFrame(tick);
  }
  tick();
}());

/* ============================================================
   EMAIL COPY
   ============================================================ */
document.querySelectorAll('.contact-strip__email').forEach((el) => {
  el.addEventListener('click', () => {
    const email = el.dataset.email || el.textContent.trim();
    navigator.clipboard.writeText(email).then(() => {
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 2000);
    });
  });
});
