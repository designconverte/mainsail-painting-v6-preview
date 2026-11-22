/* Mainsail Painting · blog behavior (vanilla, no dependencies). Everything works without this file: the search form
   posts to /blog/ (the static list), the TOC is plain anchors, share links are plain URLs.
   - search: instant, over /blog/search.json (fetched on first use), AND of the typed words, title > topics > text
   - table of contents: highlights the section on screen (aria-current)
   - reading progress line; "Copy link" when the clipboard API exists */
(function () {
  'use strict';

  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // this file's URL: the index and the post links resolve against it (a preview subfolder rewrites only the HTML)
  var SCRIPT_SRC = (doc.currentScript && doc.currentScript.src) || window.location.href;
  var ROOT = new URL('../../', SCRIPT_SRC).pathname; // "/" in production, "/<slug>-preview/…/" on the preview
  var siteUrl = function (p) { return ROOT + String(p).replace(/^\//, ''); };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fmtDate = function (iso) { var p = iso.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0]; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9°]+/g, ' ').trim(); };

  /* ---------- search ---------- */
  var form = $('form[data-bsearch]');
  var input = form && $('[data-bsearch-input]', form);
  var results = $('[data-bresults]');
  var list = $('[data-blist]');
  var status = $('[data-bsearch-status]');
  var onIndex = !!(results && list && status && input && input.id === 'bsearch-q');
  var index = null;
  var loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch(new URL('../../blog/search.json', SCRIPT_SRC).href, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('search index ' + r.status); return r.json(); })
      .then(function (data) {
        index = (data.posts || []).map(function (p) {
          return { p: p, t: norm(p.t), k: norm(p.k + ' ' + p.c), d: norm(p.d) };
        });
        return index;
      })
      .catch(function () { loading = null; index = null; throw new Error('offline'); });
    return loading;
  }

  function score(entry, words) {
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var re = new RegExp('(^| )' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      var s = 0;
      if (re.test(entry.t)) s += 6; else if (entry.t.indexOf(w) > -1) s += 3;
      if (re.test(entry.k)) s += 3;
      if (re.test(entry.d)) s += 2;
      if (!s) return 0; // every word has to match somewhere
      total += s;
    }
    return total;
  }

  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (w.length < 2) return;
      out = out.replace(new RegExp('(^|[^a-z0-9])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-z0-9]*)', 'gi'), '$1<mark>$2</mark>');
    });
    return out;
  }

  function render(q) {
    var words = norm(q).split(' ').filter(Boolean);
    var title = $('[data-bresults-title]', results);
    var ol = $('[data-bresults-list]', results);
    var empty = $('[data-bresults-empty]', results);
    if (!words.length) {
      results.hidden = true;
      list.hidden = false;
      status.textContent = '';
      return;
    }
    var hits = index.map(function (e) { return { e: e, s: score(e, words) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s || (a.e.p.a < b.e.p.a ? 1 : -1); });
    ol.innerHTML = hits.map(function (h) {
      var p = h.e.p;
      var t = mark(p.t, words);
      var head = p.u ? '<a href="' + esc(siteUrl(p.u)) + '">' + t + '</a>' : '<span class="bres__demo">Sample card</span>' + t;
      return '<li class="bres"><h3 class="bres__t">' + head + '</h3>' +
        '<p class="bres__m">' + esc(p.c) + ' · <time datetime="' + esc(p.a) + '">' + fmtDate(p.a) + '</time> · ' + p.r + ' min read</p>' +
        '<p class="bres__x">' + mark(p.d, words) + '</p></li>';
    }).join('');
    var n = hits.length;
    var qq = '“' + q.trim() + '”';
    title.textContent = n ? 'Results for ' + qq : 'Nothing found for ' + qq;
    empty.hidden = n > 0;
    ol.hidden = n === 0;
    results.hidden = false;
    list.hidden = true;
    status.textContent = n === 0 ? 'No articles match ' + qq + '.' : n + (n === 1 ? ' article matches ' : ' articles match ') + qq + '.';
  }

  function syncUrl(q) {
    try {
      var u = new URL(window.location.href);
      if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* history unavailable: the search still works */ }
  }

  if (onIndex) {
    var timer = 0;
    var run = function () {
      var q = input.value;
      load().then(function () { render(q); syncUrl(q.trim()); }).catch(function () {
        status.textContent = 'Search is unavailable right now. Browse the articles below.';
      });
    };
    input.addEventListener('focus', function () { load().catch(function () {}); }, { once: true });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 110); });
    form.addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(timer); run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; run(); }
      if (e.key === 'ArrowDown') { var first = $('.bres a', results); if (first && !results.hidden) { e.preventDefault(); first.focus(); } }
    });
    var clear = $('[data-bresults-clear]', results);
    if (clear) clear.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
    // "/" jumps to the search box (not while typing in a field)
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      input.focus();
    });
    // /blog/?q=… (from the sidebar search on other pages, or a shared link) runs on load
    var initial = new URLSearchParams(window.location.search).get('q');
    if (initial) { input.value = initial; run(); }
  }

  /* ---------- table of contents: the section on screen ---------- */
  var toc = $('[data-btoc]');
  if (toc && 'IntersectionObserver' in window) {
    var links = $$('a[href^="#"]', toc);
    var map = {};
    var targets = links.map(function (a) {
      var el = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (el) map[el.id] = a;
      return el;
    }).filter(Boolean);
    var current = null;
    var setCurrent = function (id) {
      if (current === id) return;
      current = id;
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (map[id]) map[id].setAttribute('aria-current', 'true');
    };
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      // the last heading that has passed the top band wins
      var pick = null;
      for (var i = 0; i < targets.length; i++) {
        var r = targets[i].getBoundingClientRect();
        if (r.top < window.innerHeight * 0.35) pick = targets[i].id;
      }
      setCurrent(pick || (targets[0] && targets[0].id));
    }, { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] });
    targets.forEach(function (t) { io.observe(t); });
  }
  // the inline TOC (phones and tablets) closes after a jump
  var inlineToc = $('[data-btoc-inline]');
  // (closed BEFORE the jump: closing it after would pull the page up by the list's height and miss the heading)
  if (inlineToc) inlineToc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target) return;
    e.preventDefault();
    inlineToc.open = false;
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      // keyboard and screen reader users continue reading from the heading, as with a native anchor
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      try { history.replaceState(null, '', a.getAttribute('href')); } catch (err) { /* hash stays as is */ }
    });
  });

  /* ---------- reading progress ---------- */
  var bar = $('[data-bprog]');
  var article = $('[data-bprose]');
  if (bar && article) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var r = article.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------- copy link ---------- */
  var copy = $('[data-bshare-copy]');
  var shareStatus = $('[data-bshare-status]');
  if (copy && navigator.clipboard && window.isSecureContext) {
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(copy.getAttribute('data-bshare-copy')).then(function () {
        if (shareStatus) shareStatus.textContent = 'Link copied.';
        setTimeout(function () { if (shareStatus) shareStatus.textContent = ''; }, reduceMotion ? 4000 : 3000);
      }).catch(function () { if (shareStatus) shareStatus.textContent = 'Copy failed. Use the address bar.'; });
    });
  }
})();
