/* Mainsail Painting · page behavior (vanilla, no dependencies). Everything works without this file:
   links, the form's no-JS post, the services list (scrollable), the comparators at 50%, the chart (all towns lit)
   and the FAQ. V2 adds the header state, the pinned services, the awards band, the chart beam and ZIP course, the
   form's composed details and ticket, and the FAQ motion. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
  // automated browsers (crawlers, test runners) skip the decorative video: the player answers them with a bot check
  var automated = navigator.webdriver === true;
  // this file's URL: assets loaded by JS are resolved against it (the preview subfolder rewrites only the HTML)
  var SCRIPT_SRC = (doc.currentScript && doc.currentScript.src) || '';
  var assetUrl = function (rel) { try { return new URL(rel, SCRIPT_SRC || window.location.href).href; } catch (err) { return rel; } };

  /* ---------- smooth scroll (Lenis 1.3.23, self-hosted in assets/vendor, MIT) ----------
     Only with a mouse / trackpad (touch keeps the phone's own scrolling) and never with reduced motion. Loaded after
     the page (not in the first paint). Everything that scrolls the page goes through smoothTo() so anchors keep the
     fixed header's offset; work that follows the scroll (the pinned services) subscribes with onSmooth() and runs in
     the same frame as Lenis, so it never lags one frame behind the sticky stage. */
  var lenis = null;
  var smoothSubs = [];
  function onSmooth(fn) { smoothSubs.push(fn); }
  function headerOffset() { return parseFloat(getComputedStyle(root).scrollPaddingTop) || 0; }
  function smoothTo(target, extra) {
    var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY - headerOffset() + (extra || 0);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  var wantsSmooth = !reduceMotion && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (wantsSmooth) {
    var bootLenis = function () {
      var sc = doc.createElement('script');
      sc.src = assetUrl('../vendor/lenis.min.js');
      sc.async = true;
      sc.onload = function () {
        if (typeof window.Lenis !== 'function' || lenis) return;
        lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, autoRaf: true });
        root.classList.add('has-lenis');
        lenis.on('scroll', function () { for (var i = 0; i < smoothSubs.length; i++) smoothSubs[i](); });
        // in-page anchors: smooth, with the fixed header's offset (CSS scroll-padding-top is not seen by Lenis)
        doc.addEventListener('click', function (e) {
          var a = e.target.closest && e.target.closest('a[href^="#"]');
          if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
          var id = a.getAttribute('href').slice(1);
          var el = id && doc.getElementById(id);
          if (!el) return;
          e.preventDefault();
          smoothTo(el);
          if (window.history && window.history.pushState) window.history.pushState(null, '', '#' + id);
        });
      };
      doc.head.appendChild(sc);
    };
    if (doc.readyState === 'complete') setTimeout(bootLenis, 0);
    else window.addEventListener('load', function () { setTimeout(bootLenis, 0); }, { once: true });
  }

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- services dropdown (hover, click, Esc, click outside) ---------- */
  $$('[data-drop]').forEach(function (drop) {
    var btn = $('[data-drop-btn]', drop);
    var panel = $('[data-drop-panel]', drop);
    if (!btn || !panel) return;
    var hoverable = window.matchMedia('(hover: hover)').matches;
    var closedByUser = false;
    var hovering = false;
    function setOpen(open) {
      drop.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      var open = !drop.classList.contains('is-open');
      closedByUser = !open && hovering;
      setOpen(open);
    });
    if (hoverable) {
      drop.addEventListener('mouseenter', function () { hovering = true; if (!closedByUser) setOpen(true); });
      drop.addEventListener('mouseleave', function () { hovering = false; closedByUser = false; setOpen(false); });
    }
    drop.addEventListener('focusout', function (e) {
      if (!drop.contains(e.relatedTarget)) setOpen(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !drop.classList.contains('is-open')) return;
      var hadFocus = drop.contains(doc.activeElement);
      closedByUser = hovering;
      setOpen(false);
      if (hadFocus) btn.focus();
    });
    doc.addEventListener('click', function (e) {
      if (!drop.contains(e.target) && drop.classList.contains('is-open')) setOpen(false);
    });
  });

  /* ---------- mobile menu (dialog: focus kept inside, Esc closes, page behind is inert) ---------- */
  var menu = $('[data-menu]');
  var opener = $('[data-menu-open]');
  if (menu && opener) {
    var closer = $('[data-menu-close]', menu);
    var outside = $$('body > *').filter(function (el) { return el !== menu && el.tagName !== 'SCRIPT'; });
    var openMenu = function () {
      menu.hidden = false;
      root.classList.add('menu-open');
      if (lenis) lenis.stop();
      opener.setAttribute('aria-expanded', 'true');
      outside.forEach(function (el) { el.inert = true; });
      closer.focus();
    };
    var closeMenu = function (returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      root.classList.remove('menu-open');
      if (lenis) lenis.start();
      opener.setAttribute('aria-expanded', 'false');
      outside.forEach(function (el) { el.inert = false; });
      if (returnFocus !== false) opener.focus();
    };
    opener.addEventListener('click', openMenu);
    closer.addEventListener('click', function () { closeMenu(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
      if (e.key !== 'Tab' || menu.hidden) return;
      var focusables = $$('a[href], button:not([disabled])', menu).filter(function (el) { return el.offsetParent !== null; });
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100) closeMenu(false); });
  }

  /* ---------- background videos (Vimeo player in background mode) ----------
     Never with reduced motion or Save-Data / 2G. The hero starts after `load`; the award video when it is near the
     viewport. The iframe stays at opacity .01 until the player reports `play`; the photo underneath is the LCP. */
  var PLAYER_ORIGIN = 'https://player.vimeo.com';
  var players = [];

  function post(p, method, value) {
    if (!p.iframe || !p.iframe.contentWindow) return;
    var msg = { method: method };
    if (value !== undefined) msg.value = value;
    p.iframe.contentWindow.postMessage(JSON.stringify(msg), PLAYER_ORIGIN);
  }

  function setToggle(p) {
    if (!p.toggle) return;
    var paused = p.userPaused;
    p.toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    var use = $('use', p.toggle);
    if (use) use.setAttribute('href', paused ? '#i-play' : '#i-pause');
    var label = $('[data-video-label]', p.toggle);
    if (label) label.textContent = paused ? 'Play background video' : 'Pause background video';
  }

  function mountVideo(p) {
    if (p.iframe) return;
    var id = p.host.getAttribute('data-vimeo');
    var iframe = doc.createElement('iframe');
    iframe.src = PLAYER_ORIGIN + '/video/' + encodeURIComponent(id) + '?background=1&autoplay=1&loop=1&muted=1&dnt=1&autopause=0';
    iframe.title = p.host.getAttribute('data-vimeo-title') || 'Background video';
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('loading', 'eager');
    p.iframe = iframe;
    iframe.addEventListener('load', function () {
      post(p, 'addEventListener', 'play');
      post(p, 'addEventListener', 'pause');
    });
    p.host.appendChild(iframe);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== PLAYER_ORIGIN) return;
    var data = e.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (err) { return; }
    }
    if (!data || typeof data !== 'object') return;
    players.forEach(function (p) {
      if (!p.iframe || e.source !== p.iframe.contentWindow) return;
      if (data.event === 'ready') {
        post(p, 'addEventListener', 'play');
        post(p, 'addEventListener', 'pause');
      }
      if (data.event === 'play') {
        p.iframe.classList.add('is-playing');
        if (p.toggle) p.toggle.hidden = false;
        if (p.userPaused || !p.inView) post(p, 'pause');
      }
    });
  });

  if (!reduceMotion && !saveData && !automated) {
    $$('[data-vimeo]').forEach(function (host) {
      var section = host.closest('section');
      var p = { host: host, section: section, toggle: section ? $('[data-video-toggle]', section) : null, iframe: null, userPaused: false, inView: true, lazy: host.hasAttribute('data-vimeo-lazy') };
      players.push(p);
      if (p.toggle) {
        p.toggle.addEventListener('click', function () {
          p.userPaused = !p.userPaused;
          post(p, p.userPaused ? 'pause' : 'play');
          setToggle(p);
        });
      }
      if ('IntersectionObserver' in window && section) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            p.inView = entry.isIntersecting;
            if (p.inView && p.lazy && p.armed) mountVideo(p);
            if (!p.iframe) return;
            if (!p.inView) post(p, 'pause');
            else if (!p.userPaused) post(p, 'play');
          });
        }, { rootMargin: '200px 0px' }).observe(section);
      }
    });
    var arm = function () {
      players.forEach(function (p) {
        p.armed = true;
        if (!p.lazy || p.inView) mountVideo(p);
      });
    };
    var start = function () { setTimeout(arm, 600); };
    if (doc.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    // lazy players start "in view" only once the observer says so
    players.forEach(function (p) { if (p.lazy) p.inView = false; });
  }

  /* ---------- header: shadow once the page leaves the top (the glass itself is always on) ---------- */
  var hdr = $('[data-header]');
  if (hdr) {
    var hdrTick = false;
    var hdrSet = function () { hdrTick = false; hdr.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', function () { if (!hdrTick) { hdrTick = true; window.requestAnimationFrame(hdrSet); } }, { passive: true });
    hdrSet();
  }

  /* ---------- services (V2): the section pins (CSS sticky) and the seven cards travel right to left while the page
     scrolls down, phones included. No scroll-snap (round 2: it pulled the page back on phones); the arrows and the
     keyboard still go card by card. Reduced motion, no sticky or
     no JS: the V1 swipeable row with arrows. ---------- */
  var hs = $('[data-hscroll]');
  var pinned = null;
  if (hs && !reduceMotion && window.CSS && CSS.supports && CSS.supports('position', 'sticky')) {
    pinned = (function () {
      var stick = $('[data-hscroll-stick]', hs);
      var track = $('[data-hscroll-track]', hs);
      var prog = $('[data-hscroll-prog]', hs);
      var head = $('.svcs__head', hs);
      var cards = $$('.svc', track);
      if (!stick || !track || !prog || !head || cards.length < 2) return null;
      var imgs = cards.map(function (c) { return $('.svc__img', c); });
      var bar = $('.svcs__bar i', prog);
      var cnt = $('.svcs__count b', prog);
      var n = cards.length;
      var st = { dist: 0, stops: [], cw: 0, w: 0, padL: 0, vw: 0, vh: 0, lastW: 0, lastH: 0, ticking: false, k: 0, p: 0 };

      var ready = false;
      function px(v) { return parseFloat(v) || 0; }
      function layout() {
        if (!ready) {
          ready = true;
          hs.classList.add('is-pinned');
          prog.hidden = false;
          track.removeAttribute('tabindex');
        }
        st.vw = root.clientWidth;
        st.vh = stick.clientHeight;
        st.lastW = st.vw; st.lastH = window.innerHeight;
        var mobile = st.vw < 1024;
        var cs = getComputedStyle(stick);
        var avail = st.vh - px(cs.paddingTop) - px(cs.paddingBottom) - head.offsetHeight - px(getComputedStyle(head).marginBottom) - prog.offsetHeight - px(getComputedStyle(prog).marginTop);
        var gap = px(getComputedStyle(track).columnGap);
        var ratio = mobile ? 0.8 : 1.5;
        var target = mobile ? st.vw * 0.82 : (head.clientWidth - gap) / 2;
        var h = Math.max(220, Math.min(target / ratio, avail));
        st.w = Math.round(h * ratio);
        hs.style.setProperty('--svc-w', st.w + 'px');
        hs.style.setProperty('--svc-h', Math.round(h) + 'px');
        var tcs = getComputedStyle(track);
        st.padL = px(tcs.paddingLeft);
        st.cw = st.w + gap;
        var total = st.padL + n * st.w + (n - 1) * gap + px(tcs.paddingRight);
        st.dist = Math.max(0, Math.round(total - st.vw));
        hs.style.height = (st.vh + st.dist) + 'px';
        // one stop per card edge, the last one at the end of the travel
        st.stops = [];
        for (var k = 0; k < n; k++) {
          var s = Math.min(st.dist, k * st.cw);
          if (!st.stops.length || s - st.stops[st.stops.length - 1] > 4) st.stops.push(s);
        }
        placeSnaps();
        update();
      }
      // optional stop on each card, touch only. OFF by default (round 2: smoother without it). To compare on a phone,
      // add data-hscroll-snap to the services <section> in src/pages/home.html and rebuild: nothing else changes.
      var snapOn = hs.hasAttribute('data-hscroll-snap') && window.matchMedia('(pointer: coarse)').matches;
      var snaps = [];
      function placeSnaps() {
        if (!snapOn) return;
        root.classList.add('hs-snap');
        var sp = px(getComputedStyle(root).scrollPaddingTop);
        snaps.forEach(function (el) { el.parentNode.removeChild(el); });
        snaps = st.stops.map(function (s) {
          var a = doc.createElement('span');
          a.className = 'svcs__snap';
          a.setAttribute('aria-hidden', 'true');
          a.style.top = (s + sp) + 'px';
          hs.appendChild(a);
          return a;
        });
      }
      function nearest(x) {
        var best = 0;
        st.stops.forEach(function (s, k) { if (Math.abs(s - x) < Math.abs(st.stops[best] - x)) best = k; });
        return best;
      }
      function update() {
        st.ticking = false;
        if (!ready) return;
        var top = hs.getBoundingClientRect().top;
        var p = st.dist ? Math.min(1, Math.max(0, -top / st.dist)) : 0;
        st.p = p;
        var x = -p * st.dist;
        track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        var k = p > 0.995 ? n - 1 : Math.min(n - 1, Math.round(-x / st.cw));
        if (k !== st.k || !cnt.textContent) { st.k = k; cnt.textContent = (k + 1 < 10 ? '0' : '') + (k + 1); }
        // the photo drifts a little inside each card, against the travel
        var half = st.vw / 2;
        imgs.forEach(function (img, i) {
          if (!img) return;
          var c = st.padL + i * st.cw + st.w / 2 + x;
          var off = Math.max(-1, Math.min(1, (c - half) / st.vw));
          img.style.transform = 'translate3d(' + (-off * 0.05 * st.w).toFixed(1) + 'px,0,0)';
        });
        updateArrows();
      }
      function onScroll() { if (!st.ticking) { st.ticking = true; window.requestAnimationFrame(update); } }
      window.addEventListener('scroll', onScroll, { passive: true });
      onSmooth(update);
      var rt;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          // the phone's address bar resizes the window all the time; only a real change of size relayouts
          if (root.clientWidth !== st.lastW || Math.abs(window.innerHeight - st.lastH) > 120) layout();
        }, 150);
      });
      // first layout after the page has loaded (keeps the measuring work out of the first paint); the section is far
      // below the fold, so its new height never moves anything on screen
      var first = function () { window.requestAnimationFrame(layout); if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { if (ready) layout(); }); };
      if (doc.readyState === 'complete') first();
      else window.addEventListener('load', first, { once: true });
      // keyboard: a card that takes focus is brought into the window
      track.addEventListener('focusin', function (e) {
        var card = e.target.closest('.svc');
        var i = cards.indexOf(card);
        if (i < 0) return;
        stick.scrollLeft = 0; track.scrollLeft = 0; // older engines without overflow: clip scroll the box to the focus
        goTo(Math.min(st.stops.length - 1, i));
      });
      function secTop() { return hs.getBoundingClientRect().top + window.scrollY; }
      function goTo(k) {
        k = Math.max(0, Math.min(st.stops.length - 1, k));
        smoothTo(secTop() + st.stops[k]);
      }
      var arrows = null;
      function updateArrows() {
        if (!arrows) return;
        arrows.prev.disabled = st.p <= 0.002;
        arrows.next.disabled = st.p >= 0.998;
      }
      return {
        bindArrows: function (prev, next) {
          arrows = { prev: prev, next: next };
          prev.addEventListener('click', function () { goTo(nearest(st.p * st.dist) - 1); });
          next.addEventListener('click', function () { goTo(nearest(st.p * st.dist) + 1); });
          updateArrows();
        }
      };
    })();
  }

  /* ---------- services arrows: move the pinned row, or scroll the V1 row (native scroll-snap) ---------- */
  $$('[data-carousel]').forEach(function (track) {
    var section = track.closest('section');
    var nav = section && $('[data-carousel-nav]', section);
    if (!nav) return;
    var prev = $('[data-carousel-prev]', nav);
    var next = $('[data-carousel-next]', nav);
    nav.hidden = false;
    if (pinned) { pinned.bindArrows(prev, next); return; }
    function step() {
      var card = track.firstElementChild;
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- before / after comparators ---------- */
  $$('[data-ba]').forEach(function (fig) {
    var frame = $('.ba__frame', fig);
    var range = $('.ba__range', fig);
    if (!frame || !range) return;
    var set = function () { frame.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    set();
  });

  /* ---------- awards band: the badges rise in turn when the section comes into view ---------- */
  var band = $('.badges--award');
  if (band) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      var bio = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { band.classList.add('is-in'); bio.disconnect(); } });
      }, { threshold: 0.25 });
      bio.observe(band);
    } else band.classList.add('is-in');
  }

  /* ---------- areas we serve: the chart (beam, ZIP course) + the Google map on request ----------
     The chart file and the ZIP table stay out of the HTML (the document fits the first round trip); they are fetched
     when the area or the form comes near, with paths relative to this script (the preview subfolder works). */
  var ZIPS = {};
  var chart = null;
  var areaReady = null;
  function zipInfo(zip) {
    var z = ZIPS[zip];
    return z ? { town: z[0], cape: z[1] === 'C', x: z[2], y: z[3] } : null;
  }
  function loadArea() {
    if (areaReady) return areaReady;
    var get = function (rel, type) {
      if (!window.fetch) return Promise.resolve(null);
      return window.fetch(assetUrl(rel)).then(function (r) { return r.ok ? r[type]() : null; }).catch(function () { return null; });
    };
    var slot = $('[data-am-slot]');
    areaReady = Promise.all([
      get('area-zips.json', 'json').then(function (j) { if (j) ZIPS = j; }),
      slot ? get('../img/area/areamap.svg', 'text').then(function (t) {
        if (!t || t.indexOf('<svg') < 0) return;
        slot.innerHTML = t;
        var svg = $('svg', slot);
        if (svg) { svg.classList.remove('am--static'); chart = initChart(svg); }
      }) : null,
    ]);
    return areaReady;
  }
  if ('IntersectionObserver' in window) {
    var lio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { lio.disconnect(); loadArea(); } });
    }, { rootMargin: '1200px 0px' });
    $$('#area, #schedule').forEach(function (el) { lio.observe(el); });
  } else loadArea();

  function initChart(am) {
    var SVGNS = 'http://www.w3.org/2000/svg';
    var amPts = $$('.am__t', am);
    var sweep = $('.am__sweep', am);
    var route = $('.am__route', am);
    var bx = Number(am.getAttribute('data-bx'));
    var by = Number(am.getAttribute('data-by'));
    var pick = null;
    var fit = function () {
      var w = am.getBoundingClientRect().width;
      if (!w) return;
      am.style.setProperty('--inv', Math.min(3, Math.max(1, 0.85 / (w / 1000))).toFixed(3));
    };
    fit();
    window.addEventListener('resize', fit);
    var lightAll = function () { amPts.forEach(function (t) { t.classList.add('is-lit'); }); am.classList.add('is-done'); };
    var spin = function () {
      if (reduceMotion) { lightAll(); return; }
      var from = -90, dur = 3400, t0 = null;
      sweep.style.transition = 'opacity .5s ease';
      sweep.style.opacity = '1';
      var frame = function (now) {
        if (t0 === null) t0 = now;
        var t = Math.min(1, (now - t0) / dur);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        var a = from + 360 * e;
        sweep.setAttribute('transform', 'translate(' + bx + ' ' + by + ') rotate(' + a.toFixed(2) + ')');
        amPts.forEach(function (pt) {
          if (pt.classList.contains('is-lit')) return;
          var ang = Number(pt.getAttribute('data-ang'));
          if (((ang - from) % 360 + 360) % 360 <= a - from) {
            pt.classList.add('is-lit', 'is-flash');
            setTimeout(function () { pt.classList.remove('is-flash'); }, 280);
          }
        });
        if (t < 1) window.requestAnimationFrame(frame);
        else { sweep.style.opacity = '0'; lightAll(); }
      };
      window.requestAnimationFrame(frame);
    };
    if ('IntersectionObserver' in window) {
      var aio = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { aio.disconnect(); spin(); } });
      }, { threshold: 0.35 });
      aio.observe(am);
    } else lightAll();
    return {
      clear: function () {
        amPts.forEach(function (t) { t.classList.remove('is-pick'); });
        if (pick) { pick.remove(); pick = null; }
        route.setAttribute('d', '');
      },
      // the beam draws a course from the compass rose to the visitor's town
      show: function (info) {
        var mark = amPts.filter(function (t) { return t.getAttribute('data-town') === info.town; })[0];
        if (mark) mark.classList.add('is-pick', 'is-lit');
        else {
          pick = doc.createElementNS(SVGNS, 'g');
          pick.setAttribute('class', 'am__t is-pick is-lit');
          pick.setAttribute('transform', 'translate(' + info.x + ' ' + info.y + ')');
          var inner = doc.createElementNS(SVGNS, 'g');
          inner.setAttribute('class', 'am__in');
          inner.innerHTML = '<circle class="am__halo" r="12"/><circle class="am__dot" r="4"/><text class="am__lb" x="11" y="4.5"></text>';
          inner.querySelector('text').textContent = info.town;
          pick.appendChild(inner);
          $('.am__pts', am).appendChild(pick);
        }
        var x = info.x, y = info.y;
        var mx = (bx + x) / 2, my = (by + y) / 2 - Math.hypot(x - bx, y - by) * 0.16;
        route.setAttribute('d', 'M' + bx + ' ' + by + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x + ' ' + y);
        if (!reduceMotion && route.getTotalLength && route.animate) {
          var L = route.getTotalLength();
          route.style.strokeDasharray = L + ' ' + L;
          route.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
        } else route.style.strokeDasharray = '';
      }
    };
  }

  // ZIP check (works with or without the chart: the answer is text, the course is a bonus)
  var zc = $('[data-zipcheck]');
  if (zc) {
    var zIn = $('input', zc);
    var zOut = $('[data-zipcheck-out]', zc);
    var zGo = $('[data-zipcheck-go]', zc);
    var zBase = zOut.innerHTML;
    var lastZip = '';
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var answer = function () {
      var zip = String(zIn.value || '').replace(/\D/g, '').slice(0, 5);
      zIn.value = zip;
      if (chart) chart.clear();
      if (!/^\d{5}$/.test(zip)) {
        zOut.innerHTML = zip ? 'Enter a 5-digit ZIP code.' : zBase;
        zGo.hidden = true; lastZip = '';
        return;
      }
      lastZip = zip;
      var info = zipInfo(zip);
      zGo.hidden = false;
      if (!info) { zOut.textContent = "That ZIP may be outside our usual area. Send the request anyway and we'll let you know."; return; }
      if (chart) chart.show(info);
      zOut.innerHTML = info.cape
        ? '<b>' + esc(info.town) + '</b> is on Cape Cod, in our area. Your visit can be scheduled within 24&nbsp;hours.'
        : '<b>' + esc(info.town) + "</b> is toward the South Shore. Send the request and we'll confirm the&nbsp;visit.";
    };
    var check = function () { loadArea().then(answer, answer); };
    zIn.addEventListener('focus', loadArea);
    zc.addEventListener('submit', function (e) { e.preventDefault(); check(); });
    zIn.addEventListener('input', function () { if (zIn.value.replace(/\D/g, '').length === 5) check(); });
    zGo.addEventListener('click', function (e) {
      var target = $('#zip-schedule');
      if (!target || !lastZip) return;
      e.preventDefault();
      target.value = lastZip;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      var sec = $('#schedule');
      if (sec) smoothTo(sec);
      var first = $('#quote-schedule input[name="service"]:checked') || $('#quote-schedule input[name="service"]');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 700);
    });
  }

  /* map: the Google Business Profile embed loads only on request; the same button goes back to the chart */
  $$('[data-map]').forEach(function (box) {
    var fig = box.closest('figure') || box;
    var btn = $('[data-map-load]', fig);
    if (!btn) return;
    var iframe = null;
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      if (on && !iframe) {
        iframe = doc.createElement('iframe');
        iframe.src = box.getAttribute('data-map-src');
        iframe.title = 'Mainsail Painting on Google Maps';
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        iframe.setAttribute('allowfullscreen', '');
        box.appendChild(iframe);
      }
      if (iframe) iframe.hidden = !on;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Show the chart' : 'Show the Google map';
    });
  });

  /* ---------- form (V2): compose the optional answers into "details", ZIP -> town, the ticket on the last step ---------- */
  $$('form[data-qform]').forEach(function (form) {
    var details = $('[data-details]', form);
    var picked = function (name) { var el = $('input[name="' + name + '"]:checked', form); return el ? el.value : ''; };
    var compose = function () {
      if (!details) return;
      var parts = [];
      var timing = picked('timing'), reach = picked('reach');
      var note = form.elements.note ? form.elements.note.value.replace(/\s+/g, ' ').trim() : '';
      if (timing) parts.push('Start: ' + timing);
      if (reach) parts.push('Best way to reach: ' + reach);
      if (note) parts.push('Note: ' + note);
      details.value = parts.join(' | ').slice(0, 1000);
    };
    form.addEventListener('change', compose);
    form.addEventListener('input', function (e) { if (e.target && e.target.name === 'note') compose(); });

    // ZIP help line names the town when the ZIP is on Cape Cod or the South Shore side
    var zip = form.elements.zip;
    var zipHelp = $('[data-zip-help]', form);
    if (zip && zipHelp) {
      var helpBase = zipHelp.innerHTML;
      var setHelp = function () {
        var v = String(zip.value || '').replace(/\D/g, '');
        if (v.length === 5 && !areaReady) { loadArea().then(setHelp); return; }
        var info = v.length === 5 ? zipInfo(v) : null;
        zipHelp.innerHTML = info ? '<b>' + info.town.replace(/[&<>]/g, '') + ', MA</b> · ' + (info.cape ? 'Cape Cod' : 'toward the South Shore') : helpBase;
      };
      zip.addEventListener('input', setHelp);
      zip.addEventListener('change', setHelp);
    }

    // request ticket on the last step
    var step3 = $('[data-cs-step="3"]', form);
    var summary = $('[data-summary]', form);
    if (!step3 || !summary) return;
    var ph = $('[data-ticket-ph]', summary);
    var fill = function () {
      var svc = $('input[name="service"]:checked', form);
      $$('[data-sum]', summary).forEach(function (dd) {
        var name = dd.getAttribute('data-sum');
        var value = '';
        if (name === 'service') { var lab = svc && svc.closest('label'); value = lab ? $('.pick__n', lab).textContent : ''; }
        else if (name === 'timing') { var t = $('input[name="timing"]:checked', form); value = t && t.nextElementSibling ? t.nextElementSibling.textContent : ''; }
        else if (form.elements[name]) value = form.elements[name].value;
        dd.textContent = (value || '').trim() || '-';
      });
      var tRow = $('[data-sum-row="timing"]', summary);
      if (tRow) tRow.hidden = !picked('timing');
      if (ph) {
        ph.textContent = '';
        var src = svc && svc.closest('label') ? $('.pick__ph', svc.closest('label')) : null;
        if (src && src.firstElementChild) ph.appendChild(src.firstElementChild.cloneNode(true));
      }
    };
    new MutationObserver(function () { if (!step3.hidden) fill(); }).observe(step3, { attributes: true, attributeFilter: ['hidden'] });
  });

  /* ---------- reviews: the client's Trustindex widget, injected when the section comes near ----------
     While it loads, the slot keeps the widget's measured height (CSS, per width) and the text quotes wait hidden; if it
     doesn't render in 12 s the quotes come back. The widget also injects its own Organization + aggregateRating JSON-LD
     (Trustindex "rich snippet"); this site never publishes self-declared ratings in its schema, so that block is
     removed as soon as it appears. */
  var tiSlot = $('[data-ti-slot]');
  var tiSec = tiSlot && tiSlot.closest('section');
  if (tiSlot && tiSec && 'IntersectionObserver' in window && 'MutationObserver' in window) {
    tiSec.classList.add('ti-pending');
    var tiDone = false;
    var tiTimer = null;
    var tiRendered = function () {
      var w = $('.ti-widget', tiSlot);
      return !!(w && w.offsetHeight > 80 && $('.ti-review-item, .ti-reviews-container, .ti-footer', w));
    };
    var tiOn = function () {
      if (tiDone) return;
      tiDone = true;
      clearTimeout(tiTimer);
      tiSec.classList.remove('ti-pending', 'ti-failed');
      tiSec.classList.add('ti-on');
      [500, 2000, 6000].forEach(function (t) { setTimeout(sweepRating, t); });
    };
    var stripRating = function (node) {
      if (!node || node.nodeType !== 1) return;
      var list = $$('script[type="application/ld+json"]', node);
      list.forEach(function (sc) {
        var t = sc.textContent || '';
        if (/trustindex/i.test(t) && /aggregateRating/.test(t)) sc.remove();
      });
    };
    var sweepRating = function () { stripRating(doc.documentElement); };
    new MutationObserver(function () {
      sweepRating(); // the snippet can be added empty and filled later, so the whole page is checked each time
      if (!tiDone && tiRendered()) tiOn();
    }).observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
    // the widget's own start-up is a ~100 ms task (third party): start it when the scroll pauses, in idle time, so it
    // never lands in the middle of a flick
    var whenScrollRests = function (fn) {
      var t = null, done = false;
      var go = function () {
        if (done) return;
        done = true;
        window.removeEventListener('scroll', arm);
        if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1200 }); else setTimeout(fn, 0);
      };
      var arm = function () { clearTimeout(t); t = setTimeout(go, 180); };
      window.addEventListener('scroll', arm, { passive: true });
      arm();
    };
    var tio = new IntersectionObserver(function (es) {
      if (!es.some(function (en) { return en.isIntersecting; })) return;
      tio.disconnect();
      whenScrollRests(injectTi);
    }, { rootMargin: '600px 0px' });
    var injectTi = function () {
      var sc = doc.createElement('script');
      sc.src = tiSlot.getAttribute('data-ti-src');
      sc.defer = true;
      sc.async = true;
      sc.onerror = function () { if (!tiDone) { tiSec.classList.remove('ti-pending'); tiSec.classList.add('ti-failed'); } };
      // the widget waits for a first "activity" event (mousemove, touch, wheel, key) registered only when its loader
      // runs; the visitor already scrolled here, so that activity has happened: tell the loader (a bare event, no data)
      sc.onload = function () {
        [0, 400, 1500].forEach(function (t) { setTimeout(function () { if (!tiDone) window.dispatchEvent(new Event('mousemove')); }, t); });
      };
      tiSlot.appendChild(sc);
      tiTimer = setTimeout(function () { if (!tiDone) { tiSec.classList.remove('ti-pending'); tiSec.classList.add('ti-failed'); } }, 12000);
    };
    tio.observe(tiSec);
  }

  /* ---------- FAQ: one answer open at a time, height animated (native <details> without JS / reduced motion) ---------- */
  var faqs = $$('[data-faq]');
  if (faqs.length && !reduceMotion && typeof Element.prototype.animate === 'function') {
    faqs.forEach(function (d) { d.removeAttribute('name'); }); // exclusivity handled here so both rows animate
    var faqClose = function (d) {
      var body = $('.faq__a', d);
      var h = body.scrollHeight;
      var an = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 300, easing: 'ease' });
      an.onfinish = function () { d.open = false; };
    };
    faqs.forEach(function (d) {
      var sum = $('summary', d);
      var body = $('.faq__a', d);
      if (!sum || !body) return;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) { faqClose(d); return; }
        faqs.forEach(function (o) { if (o !== d && o.open) faqClose(o); });
        d.open = true;
        var h = body.scrollHeight;
        body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
      });
    });
  }
  /* ---------- mobile bar: after the hero call button scrolls away, hidden while the form is on screen ---------- */
  var mbar = $('[data-mbar]');
  if (mbar && 'IntersectionObserver' in window) {
    var heroCta = $('[data-hero-cta]');
    var formSection = $('#schedule');
    var pastHero = !heroCta;
    var formVisible = false;
    var render = function () { mbar.classList.toggle('is-visible', pastHero && !formVisible); };
    if (heroCta) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        render();
      }).observe(heroCta);
    }
    if (formSection) {
      new IntersectionObserver(function (entries) {
        formVisible = entries[0].isIntersecting;
        render();
      }, { threshold: 0.15 }).observe(formSection);
    }
    render();
  }

  /* =================================================================================================================
     F4b · internal pages. Each block runs only if its markup is on the page; everything degrades to plain HTML.
     ================================================================================================================= */

  /* ---------- form: the page's service already chosen (service pages; the tile stays editable) ---------- */
  $$('form[data-preselect]').forEach(function (form) {
    var v = form.getAttribute('data-preselect');
    if (!v) return;
    $$('input[name="service"]', form).forEach(function (r) { if (r.value === v) r.checked = true; });
  });

  /* ---------- ZIP starter: step 1 in the first screen. It carries the ZIP into the page's form; with the service
     already chosen it moves the form to step 2 (the module validates as usual), otherwise it stops on the tiles.
     Without JS it is a plain link-like form that lands on the form section. ---------- */
  $$('form[data-starter]').forEach(function (st) {
    var target = doc.getElementById(st.getAttribute('data-starter'));
    var zin = $('input', st);
    var err = $('[data-starter-err]', st);
    if (!target || !zin) return;
    st.addEventListener('submit', function (e) {
      e.preventDefault();
      var zip = String(zin.value || '').replace(/\D/g, '').slice(0, 5);
      zin.value = zip;
      if (!/^\d{5}$/.test(zip)) {
        if (err) err.hidden = false;
        zin.setAttribute('aria-invalid', 'true');
        zin.focus();
        return;
      }
      if (err) err.hidden = true;
      zin.removeAttribute('aria-invalid');
      var z = target.elements.zip;
      if (z) {
        z.value = zip;
        z.dispatchEvent(new Event('input', { bubbles: true }));
        z.dispatchEvent(new Event('change', { bubbles: true }));
      }
      smoothTo(target.closest('section') || target);
      var chosen = $('input[name="service"]:checked', target);
      var onStep1 = !$('[data-cs-step="1"]', target).hidden;
      setTimeout(function () {
        if (chosen && onStep1) {
          var next = $('[data-cs-step="1"] [data-cs-next]', target);
          if (next) next.click();
        } else if (!chosen) {
          var first = $('input[name="service"]', target);
          if (first) first.focus({ preventScroll: true });
        }
      }, reduceMotion ? 0 : 900);
    });
    zin.addEventListener('input', function () { if (err && !err.hidden && /^\d{5}$/.test(zin.value.replace(/\D/g, ''))) { err.hidden = true; zin.removeAttribute('aria-invalid'); } });
  });

  /* ---------- the mobile bar's "Schedule" goes to this page's form when the page has one ---------- */
  (function () {
    var bar = $('[data-mbar]');
    var sch = bar && $('[data-float-type="schedule"]', bar);
    if (sch && !$('[data-page="home"]')) { var to = $('#quote') || $('#schedule'); if (to) sch.setAttribute('href', '#' + to.id); }
  })();

  /* ---------- reveal: content already in the HTML gets a one-time entrance when it arrives ---------- */
  var revs = $$('[data-reveal]');
  if (revs.length) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      var rio = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); } });
      }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
      revs.forEach(function (el) { rio.observe(el); });
    } else revs.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- YouTube background videos (the client's own clips; poster frame underneath) ----------
     Same rules as the home's Vimeo: never with reduced motion, Save-Data / 2G or an automated browser; mounted after
     `load` and only when the section is near; paused off screen; pause button (WCAG 2.2.2) once it plays. */
  var YT = 'https://www.youtube-nocookie.com';
  var ytBgs = [];
  function ytCmd(f, func) {
    if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), YT);
  }
  if (!reduceMotion && !saveData && !automated && 'IntersectionObserver' in window) {
    $$('[data-yt]').forEach(function (host) {
      var section = host.closest('section');
      var p = { host: host, iframe: null, inView: false, armed: false, userPaused: false, toggle: section ? $('[data-video-toggle]', section) : null };
      ytBgs.push(p);
      var mount = function () {
        if (p.iframe) return;
        var id = encodeURIComponent(host.getAttribute('data-yt'));
        var q = 'autoplay=1&mute=1&controls=0&loop=1&playlist=' + id + '&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&fs=0&enablejsapi=1';
        var s = parseInt(host.getAttribute('data-yt-start') || '0', 10);
        if (s) q += '&start=' + s;
        q += '&origin=' + encodeURIComponent(window.location.origin);
        var f = doc.createElement('iframe');
        f.src = YT + '/embed/' + id + '?' + q;
        f.title = host.getAttribute('data-yt-title') || 'Background video';
        f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        f.setAttribute('tabindex', '-1');
        f.setAttribute('aria-hidden', 'true');
        f.addEventListener('load', function () {
          // ask the player to report its state (it answers with onStateChange / infoDelivery messages)
          f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: id }), YT);
        });
        p.iframe = f;
        host.appendChild(f);
      };
      p.mount = mount;
      if (p.toggle) {
        p.toggle.addEventListener('click', function () {
          p.userPaused = !p.userPaused;
          ytCmd(p.iframe, p.userPaused ? 'pauseVideo' : 'playVideo');
          p.toggle.setAttribute('aria-pressed', p.userPaused ? 'true' : 'false');
          var use = $('use', p.toggle);
          if (use) use.setAttribute('href', p.userPaused ? '#i-play' : '#i-pause');
          var label = $('[data-video-label]', p.toggle);
          if (label) label.textContent = p.userPaused ? 'Play background video' : 'Pause background video';
        });
      }
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          p.inView = en.isIntersecting;
          if (p.inView && p.armed) mount();
          if (!p.iframe) return;
          ytCmd(p.iframe, p.inView && !p.userPaused ? 'playVideo' : 'pauseVideo');
        });
      }, { rootMargin: '200px 0px' }).observe(section || host);
    });
    window.addEventListener('message', function (e) {
      if (e.origin !== YT) return;
      var d = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
      if (!d || typeof d !== 'object') return;
      var state = d.event === 'onStateChange' ? d.info : (d.event === 'infoDelivery' && d.info ? d.info.playerState : null);
      if (state !== 1) return;
      ytBgs.forEach(function (p) {
        if (!p.iframe || e.source !== p.iframe.contentWindow || p.iframe.classList.contains('is-playing')) return;
        p.iframe.classList.add('is-playing');
        if (p.toggle) p.toggle.hidden = false;
        if (!p.inView || p.userPaused) ytCmd(p.iframe, 'pauseVideo');
      });
    });
    var armYt = function () {
      setTimeout(function () {
        ytBgs.forEach(function (p) { p.armed = true; if (p.inView) p.mount(); });
      }, 700);
    };
    if (doc.readyState === 'complete') armYt();
    else window.addEventListener('load', armYt, { once: true });
  }

  /* ---------- video testimonials: the poster and a real link to YouTube; the player loads only on play ---------- */
  $$('[data-ytplay]').forEach(function (box) {
    var a = $('.ytp__play', box);
    if (!a) return;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var id = encodeURIComponent(box.getAttribute('data-ytplay'));
      var f = doc.createElement('iframe');
      f.src = YT + '/embed/' + id + '?autoplay=1&rel=0&playsinline=1&modestbranding=1';
      f.title = box.getAttribute('data-yt-title') || 'Video';
      f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      f.setAttribute('allowfullscreen', '');
      box.appendChild(f);
      a.remove();
      f.focus();
    });
  });

  /* ---------- inspiration gallery: filters + full-screen viewer (<dialog>, arrows, swipe, Esc returns focus) ---------- */
  var gal = $('[data-gallery]');
  if (gal) {
    var gItems = $$('li', gal);
    var fBtns = $$('[data-filter]');
    var fLive = $('[data-filter-live]');
    fBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        fBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        var n = 0;
        gItems.forEach(function (li) {
          var show = f === 'all' || li.getAttribute('data-cat') === f;
          li.hidden = !show;
          if (show) n++;
        });
        if (fLive) fLive.textContent = n + ' photos shown';
      });
    });
    if (typeof HTMLDialogElement === 'function') {
      var dlg = doc.createElement('dialog');
      dlg.className = 'lb';
      dlg.setAttribute('aria-label', 'Photo viewer');
      dlg.innerHTML =
        '<div class="lb__top"><span data-lb-count></span><button class="lb__btn" type="button" data-lb-close><svg class="ic" aria-hidden="true"><use href="#i-close"></use></svg><span class="sr-only">Close the photo viewer</span></button></div>' +
        '<figure class="lb__fig"><img alt="" data-lb-img>' +
        '<button class="lb__btn lb__nav lb__nav--p" type="button" data-lb-prev><svg class="ic" aria-hidden="true"><use href="#i-chev-left"></use></svg><span class="sr-only">Previous photo</span></button>' +
        '<button class="lb__btn lb__nav lb__nav--n" type="button" data-lb-next><svg class="ic" aria-hidden="true"><use href="#i-chev-right"></use></svg><span class="sr-only">Next photo</span></button></figure>' +
        '<p class="lb__cap" data-lb-cap aria-live="polite"></p>';
      doc.body.appendChild(dlg);
      var lbImg = $('[data-lb-img]', dlg);
      var lbCap = $('[data-lb-cap]', dlg);
      var lbCount = $('[data-lb-count]', dlg);
      var cur = 0;
      var opener2 = null;
      var visible = function () { return gItems.filter(function (li) { return !li.hidden; }); };
      var show = function (k) {
        var list = visible();
        if (!list.length) return;
        cur = (k + list.length) % list.length;
        var a = $('a', list[cur]);
        var im = $('img', a);
        lbImg.src = a.getAttribute('href');
        lbImg.alt = im ? im.alt : '';
        lbCap.textContent = im ? im.alt : '';
        lbCount.textContent = (cur + 1) + ' / ' + list.length;
      };
      gal.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a');
        if (!a || !gal.contains(a) || e.metaKey || e.ctrlKey || e.button !== 0) return;
        e.preventDefault();
        opener2 = a;
        show(visible().indexOf(a.closest('li')));
        dlg.showModal();
        if (lenis) lenis.stop();
        $('[data-lb-close]', dlg).focus();
      });
      $('[data-lb-close]', dlg).addEventListener('click', function () { dlg.close(); });
      $('[data-lb-prev]', dlg).addEventListener('click', function () { show(cur - 1); });
      $('[data-lb-next]', dlg).addEventListener('click', function () { show(cur + 1); });
      dlg.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () {
        if (lenis) lenis.start();
        lbImg.removeAttribute('src');
        if (opener2) opener2.focus();
      });
      var sx = null;
      var fig = $('.lb__fig', dlg);
      fig.addEventListener('pointerdown', function (e) { sx = e.clientX; });
      fig.addEventListener('pointerup', function (e) {
        if (sx === null) return;
        var dx = e.clientX - sx;
        sx = null;
        if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
      });
    }
  }
})();
