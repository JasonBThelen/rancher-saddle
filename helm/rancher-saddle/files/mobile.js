/* Rancher Saddle — Mobile Nav Toggle
   Injects a hamburger button and backdrop into the Rancher
   dashboard after Vue has mounted the layout components. */
(function () {
  'use strict';

  function init() {
    var header = document.querySelector('header');
    var sideNav = document.querySelector('.side-nav');
    if (!header || !sideNav || document.getElementById('rs-hamburger')) return false;

    // Hamburger button
    var btn = document.createElement('button');
    btn.id = 'rs-hamburger';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'rs-nav');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.addEventListener('click', toggleNav);
    document.body.appendChild(btn);

    // Give the side nav an id for aria-controls
    sideNav.id = 'rs-nav';

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

  // Close nav when Rancher's Vue Router navigates (SPA route change)
  window.addEventListener('popstate', closeNav);

  // Rancher is a Vue SPA — the layout components mount after the
  // initial HTML loads. Poll via MutationObserver until ready.
  if (!init()) {
    var observer = new MutationObserver(function () {
      if (init()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
