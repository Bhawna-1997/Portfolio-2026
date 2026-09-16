/* ============================================================
   THEME — dark (default) / light, remembered across visits.

   This file is loaded synchronously in <head> so the stored
   theme is applied to <html> before first paint (no flash).
   ============================================================ */
(function () {
  var STORAGE_KEY = 'bn-theme';
  var root = document.documentElement;

  function stored() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return (v === 'light' || v === 'dark') ? v : null;
    } catch (e) {
      return null;
    }
  }

  /* Dark is the designed default — system preference is only a
     fallback for visitors who have never toggled. Flip the
     `|| 'dark'` below to `|| systemPref()` to respect the OS. */
  function initial() {
    return stored() || 'dark';
  }

  function syncToggles(theme) {
    var isLight = theme === 'light';
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-checked', isLight ? 'true' : 'false');
      btns[i].setAttribute(
        'aria-label',
        isLight ? 'Switch to dark theme' : 'Switch to light theme'
      );
      btns[i].setAttribute('title', isLight ? 'Dark mode' : 'Light mode');
    }
  }

  function apply(theme, animate) {
    if (animate) {
      root.classList.add('theme-anim');
      window.clearTimeout(apply._t);
      apply._t = window.setTimeout(function () {
        root.classList.remove('theme-anim');
      }, 420);
    }
    root.setAttribute('data-theme', theme);
    syncToggles(theme);
  }

  /* Runs immediately, in <head>, before the body paints. */
  apply(initial(), false);

  function toggle() {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    apply(next, true);
  }

  function wire() {
    syncToggles(root.getAttribute('data-theme'));
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', toggle);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  /* Keep multiple open tabs in sync. */
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      apply(e.newValue, true);
    }
  });

  window.BNTheme = { apply: apply, toggle: toggle };
}());
