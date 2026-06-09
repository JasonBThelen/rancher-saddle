/* Rancher Saddle — Mobile Nav Toggle
   Injects a hamburger button and backdrop into the Rancher
   dashboard after Vue has mounted the layout components.

   Rancher 2.14.x has two nav elements:
     .side-menu  — compact icon rail (~70px wide, always fixed)
     .side-nav   — full text navigation (260px, expands on hover)
   The hamburger toggles body.rs-nav-open which CSS uses to
   slide both elements in from the left. */
(function () {
  'use strict';

  function init() {
    var header = document.querySelector('header');
    // Wait until at least one nav element exists
    var navReady = document.querySelector('.side-nav') || document.querySelector('.side-menu');
    if (!header || !navReady || document.getElementById('rs-hamburger')) return false;

    // Hamburger button
    var btn = document.createElement('button');
    btn.id = 'rs-hamburger';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.addEventListener('click', toggleNav);
    document.body.appendChild(btn);

    // Backdrop (tap outside to close)
    var backdrop = document.createElement('div');
    backdrop.id = 'rs-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', closeNav);
    document.body.appendChild(backdrop);

    return true;
  }

  function toggleNav() {
    var open = document.body.classList.toggle('rs-nav-open');
    var btn = document.getElementById('rs-hamburger');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeNav() {
    document.body.classList.remove('rs-nav-open');
    var btn = document.getElementById('rs-hamburger');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // Close nav when Vue Router navigates (SPA route change)
  window.addEventListener('popstate', closeNav);

  // Rancher is a Vue SPA — layout mounts after initial HTML.
  // Poll via MutationObserver until nav elements are ready.
  if (!init()) {
    var observer = new MutationObserver(function () {
      if (init()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
