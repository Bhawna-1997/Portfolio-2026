/* ============================================================
   SHARED ANIMATION SETUP
   ------------------------------------------------------------
   Loaded after the GSAP <script> tags and before content.js.

   Pages load different subsets of plugins — each one is a separate
   request, so a page only pulls what it actually animates with. This
   registers whichever of them made it onto the page and leaves the
   rest alone, so adding a plugin to a page is a one-line change in
   the HTML with nothing to update here.

   Available on the CDN at 3.13.0 (all verified, no licence needed):
     SplitText  ScrambleTextPlugin  Flip  Observer  MotionPathPlugin
     DrawSVGPlugin  MorphSVGPlugin  InertiaPlugin  Draggable
     CustomEase  ScrollSmoother  ScrollToPlugin
   Add with:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
   ============================================================ */
(function () {
  'use strict';

  if (typeof gsap === 'undefined') return;

  const present = [
    'ScrollTrigger', 'SplitText', 'ScrambleTextPlugin', 'Flip', 'Observer', 'CustomEase',
    'MotionPathPlugin', 'DrawSVGPlugin', 'MorphSVGPlugin',
    'Draggable', 'InertiaPlugin', 'ScrollToPlugin', 'ScrollSmoother',
  ].map((name) => window[name]).filter(Boolean);

  if (present.length) gsap.registerPlugin(...present);

  /* The stylesheet's easing tokens, mirrored for GSAP so a tween and a
     CSS transition on the same element move identically. Keep these in
     sync with --ease-out-expo / --ease-in-out in style.css. */
  if (window.CustomEase) {
    CustomEase.create('outExpo', '0.16, 1, 0.3, 1');
    CustomEase.create('inOut',   '0.65, 0, 0.35, 1');
  }

  /* One place to ask "should this animate at all?" — every new effect
     should check this rather than re-querying the media query. */
  window.BN_MOTION_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}());
