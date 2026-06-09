/* Rancher Saddle — Mobile Nav Toggle
   Injects a hamburger button and backdrop into the Rancher
   dashboard after Vue has mounted the layout components. */
(function () {
  'use strict';

  function check() {
    var header = document.querySelector('header');
    // Wait until at least one nav element exists
    var navReady = document.querySelector('.side-nav') || document.querySelector('.side-menu');
    var btn = document.getElementById('rs-hamburger');
    var backdrop = document.getElementById('rs-backdrop');

    if (header && navReady) {
      if (!btn) {
        // Hamburger button
        btn = document.createElement('button');
        btn.id = 'rs-hamburger';
        btn.setAttribute('aria-label', 'Toggle navigation');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span></span><span></span><span></span>';
        btn.addEventListener('click', toggleNav);
        document.body.appendChild(btn);

        // Backdrop
        backdrop = document.createElement('div');
        backdrop.id = 'rs-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.addEventListener('click', closeNav);
        document.body.appendChild(backdrop);
      }
    } else {
      // Remove elements if layout shifts (e.g. logged out)
      if (btn) btn.remove();
      if (backdrop) backdrop.remove();
      document.body.classList.remove('rs-nav-open');
    }
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

  // Intercept Vue SPA Router pushes to close nav on navigation
  var originalPushState = history.pushState;
  history.pushState = function () {
    closeNav();
    return originalPushState.apply(this, arguments);
  };
  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    closeNav();
    return originalReplaceState.apply(this, arguments);
  };

  // Close when clicking links inside sidebar (deferred to prevent browser cancelling navigation)
  document.body.addEventListener('click', function (e) {
    var link = e.target.closest('.side-nav a, .side-menu a');
    if (link) {
      setTimeout(closeNav, 150);
    }
  });

  window.addEventListener('popstate', closeNav);

  // Keep MutationObserver alive to handle transitions/logouts dynamically
  var observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  check();
})();
