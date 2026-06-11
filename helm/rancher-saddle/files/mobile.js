/* Rancher Saddle — Mobile Nav Toggle
   Injects a hamburger button and backdrop into the Rancher
   dashboard after Vue has mounted the layout components. */
(function () {
  'use strict';

  function check() {
    var header = document.querySelector('header');
    // Wait until at least one nav element exists
    var navReady =
      document.querySelector('.side-nav') ||
      document.querySelector('.side-menu');
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

    syncHeaderHeight();
    syncTabDropdowns();
  }

  // The toolbar <header> (direct <header> child of .dashboard-content,
  // no stable class in 2.14.x — see mobile.css section 3b) occupies the
  // "header" row of .dashboard-content's CSS grid, sized via
  // grid-template-rows to Rancher's fixed --header-height (55px).
  // Section 3b lets the header wrap onto extra rows on mobile to avoid
  // horizontal scrolling, but the grid row stays 55px tall, so the
  // taller header visually overlaps the page content below it. Measure
  // the real header height, shift the difference out of the next grid
  // row (so the total stays the same), and update --header-height for
  // our own .side-nav/.side-menu offset rules.
  function syncHeaderHeight() {
    var header = document.querySelector(
      'header.main-header, .dashboard-content > header',
    );
    var content = document.querySelector('.dashboard-content');
    if (!header || !content) return;

    var actual = header.offsetHeight;
    if (!actual) return;

    if (!content._rsBaseRows) {
      var rows = getComputedStyle(content)
        .gridTemplateRows.split(' ')
        .map(parseFloat);
      if (!rows.length || isNaN(rows[0])) return;
      content._rsBaseRows = rows;
    }

    var base = content._rsBaseRows;
    var delta = actual - base[0];
    var rows2 = base.slice();
    rows2[0] = actual;
    if (rows2.length > 1) {
      rows2[1] = Math.max(0, rows2[1] - delta);
    }
    content.style.setProperty(
      'grid-template-rows',
      rows2
        .map(function (v) {
          return v + 'px';
        })
        .join(' '),
      'important',
    );

    document.body.style.setProperty('--header-height', actual + 'px');
  }

  // Resource detail pages render 5-7 horizontal tabs (Pods, Metrics,
  // Services, Ingresses, Conditions, Recent Events, Related Resources)
  // whose combined width is roughly 2x the mobile viewport. When a
  // .tabbed-container's tab strip overflows, replace it with a <select>
  // that switches tabs by clicking the corresponding original tab link.
  // Strips that already fit (few/short tabs) are left as-is.
  function syncTabDropdowns() {
    var containers = document.querySelectorAll(
      '.tabbed-container > ul.tabs.horizontal',
    );
    for (var i = 0; i < containers.length; i++) {
      var tabsEl = containers[i];
      var container = tabsEl.parentElement;
      var items = [];
      for (var j = 0; j < tabsEl.children.length; j++) {
        var li = tabsEl.children[j];
        if (li.tagName === 'LI' && li.classList.contains('tab')) {
          items.push(li);
        }
      }
      if (!items.length) continue;

      var select = container.querySelector(':scope > select.rs-tab-select');
      var overflowing = tabsEl.scrollWidth > tabsEl.clientWidth + 1;

      if (!overflowing) {
        if (select) select.remove();
        container.classList.remove('rs-tabs-enhanced');
        continue;
      }

      if (!select) {
        select = document.createElement('select');
        select.className = 'rs-tab-select';
        select.setAttribute('aria-label', 'Select tab');
        select.addEventListener('change', function (e) {
          var sel = e.target;
          var link = sel._rsTabLinks && sel._rsTabLinks[sel.selectedIndex];
          if (link) link.click();
        });
        container.insertBefore(select, tabsEl);
      }
      container.classList.add('rs-tabs-enhanced');

      var labels = [];
      var links = [];
      var activeIndex = 0;
      for (var k = 0; k < items.length; k++) {
        labels.push(items[k].textContent.replace(/\s+/g, ' ').trim());
        links.push(items[k].querySelector('a') || items[k]);
        if (items[k].classList.contains('active')) activeIndex = k;
      }

      var current = [];
      for (var m = 0; m < select.options.length; m++) {
        current.push(select.options[m].textContent);
      }
      if (current.join('|') !== labels.join('|')) {
        select.innerHTML = '';
        for (var n = 0; n < labels.length; n++) {
          var opt = document.createElement('option');
          opt.textContent = labels[n];
          opt.value = String(n);
          select.appendChild(opt);
        }
      }
      select._rsTabLinks = links;
      if (select.selectedIndex !== activeIndex) {
        select.selectedIndex = activeIndex;
      }
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

  // Re-check header height and tab overflow on rotation/resize
  // (e.g. portrait <-> landscape)
  window.addEventListener('resize', function () {
    syncHeaderHeight();
    syncTabDropdowns();
  });

  // Keep MutationObserver alive to handle transitions/logouts dynamically
  var observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  check();
})();
