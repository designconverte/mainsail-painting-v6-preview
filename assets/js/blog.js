/* Mainsail Painting · blog v2 behavior (vanilla, no dependencies). Everything works without this file: the search
   form posts to /blog/?q= (the static page), the table of contents is plain anchors, share links are plain URLs.
   - instant answers (index): over /blog/search.json (fetched on first use), AND of the typed words; each article
     shows the FAQ answer or the section that matches, linked to its #id
   - table of contents: the section on screen + a line that fills as that section is read
   - reading progress line, cover photo drift (fine pointers, no reduced motion), "Copy link" */
(function () {
  'use strict';

  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  // this file's URL: the index and the post links resolve against it (a preview subfolder rewrites only the HTML)
  var SCRIPT_SRC = (doc.currentScript && doc.currentScript.src) || window.location.href;
  var ROOT = new URL('../../', SCRIPT_SRC).pathname; // "/" in production, "/<slug>-preview/…/" on the preview
  var siteUrl = function (p) { return ROOT + String(p).replace(/^\//, ''); };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fmtDate = function (iso) { var p = iso.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0]; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9°]+/g, ' ').trim(); };
  var reEsc = function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  // a few words carry no meaning in a question ("how cold is too cold to paint")
  var STOP = { a: 1, an: 1, the: 1, is: 1, are: 1, to: 1, of: 1, in: 1, on: 1, for: 1, and: 1, or: 1, do: 1, does: 1, can: 1, i: 1, you: 1, my: 1, it: 1, be: 1, what: 1, when: 1, how: 1, too: 1 };

  /* ---------- instant answers (index) ---------- */
  var box = $('[data-bask]');
  var form = box && $('form[data-bsearch]', box);
  var input = form && $('[data-bsearch-input]', form);
  var panel = box && $('[data-bresults]', box);
  var status = form && $('[data-bsearch-status]', form);
  var index = null;
  var loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch(new URL('../../blog/search.json', SCRIPT_SRC).href, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('search index ' + r.status); return r.json(); })
      .then(function (data) {
        index = (data.posts || []).map(function (p) {
          var answers = (p.f || []).map(function (f) { return f[2]; }).join(' ');
          return { p: p, t: norm(p.t), k: norm(p.k + ' ' + p.c), d: norm(p.d + ' ' + (p.x || '')), a: norm(answers) };
        });
        return index;
      })
      .catch(function () { loading = null; index = null; throw new Error('offline'); });
    return loading;
  }

  function wordsOf(q) {
    var all = norm(q).split(' ').filter(Boolean);
    var kept = all.filter(function (w) { return !STOP[w]; });
    return kept.length ? kept : all;
  }

  function score(entry, words) {
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var re = new RegExp('(^| )' + reEsc(w));
      var s = 0;
      if (re.test(entry.t)) s += 6; else if (entry.t.indexOf(w) > -1) s += 3;
      if (re.test(entry.k)) s += 3;
      if (re.test(entry.d)) s += 2;
      if (re.test(entry.a)) s += 1;
      if (!s) return 0; // every word has to match somewhere
      total += s;
    }
    return total;
  }

  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (w.length < 2) return;
      out = out.replace(new RegExp('(^|[^a-z0-9])(' + reEsc(w) + '[a-z0-9]*)', 'gi'), '$1<mark>$2</mark>');
    });
    return out;
  }

  // inside one article: the FAQ answer that holds every word, then up to two sections whose heading holds one
  function deepLinks(p, words) {
    var out = [];
    var best = null;
    (p.f || []).forEach(function (f) {
      var q = norm(f[1]);
      var a = norm(f[2]);
      var s = 0;
      var all = words.every(function (w) {
        if (q.indexOf(w) > -1) { s += 2; return true; }
        if (a.indexOf(w) > -1) { s += 1; return true; }
        return false;
      });
      if (all && (!best || s > best.s)) best = { s: s, f: f };
    });
    if (best) out.push({ id: best.f[0], kind: 'Answer', title: best.f[1], text: best.f[2] });
    (p.s || []).forEach(function (h) {
      if (out.length >= 3) return;
      var t = norm(h[1]);
      if (words.some(function (w) { return w.length > 2 && t.indexOf(w) > -1; })) out.push({ id: h[0], kind: 'Section', title: h[1], text: '' });
    });
    return out;
  }

  function renderResults(q) {
    var words = wordsOf(q);
    var title = $('[data-bresults-title]', panel);
    var ol = $('[data-bresults-list]', panel);
    var empty = $('[data-bresults-empty]', panel);
    if (!words.length) { close(); status.textContent = ''; return; }
    var hits = index.map(function (e) { return { e: e, s: score(e, words) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s || (a.e.p.a < b.e.p.a ? 1 : -1); });
    ol.innerHTML = hits.map(function (h) {
      var p = h.e.p;
      var url = p.u ? siteUrl(p.u) : '';
      var img = p.i ? '<img class="bres__img" src="' + esc(siteUrl(p.i)) + '" alt="" width="112" height="63" loading="lazy" decoding="async">' : '<span class="bres__img" aria-hidden="true"></span>';
      var meta = esc(p.c) + ' · ' + fmtDate(p.a) + ' · ' + p.r + ' min read' + (p.n ? ' · ' + p.n + ' sources' : '');
      var deep = p.u ? deepLinks(p, words) : [];
      var snippet = p.x || p.d; // the article's short answer when it has one
      var body = '<span class="bres__body"><span class="bres__m">' + meta + '</span><span class="bres__t">' + (p.u ? '' : '<span class="bres__demo">Sample card</span>') + mark(p.t, words) + '</span><span class="bres__x">' + mark(snippet, words) + '</span></span>';
      var head = p.u ? '<a class="bres__a" href="' + esc(url) + '">' + img + body + '</a>' : '<div class="bres__a">' + img + body + '</div>';
      var links = deep.map(function (d) {
        return '<li><a href="' + esc(url + '#' + d.id) + '"><span class="bres__k">' + d.kind + '</span><span class="bres__q">' + mark(d.title, words) + '</span>' +
          (d.text ? '<span class="bres__ans">' + mark(d.text, words) + '</span>' : '') + '</a></li>';
      }).join('');
      return '<li class="bres">' + head + (links ? '<ul class="bres__deep">' + links + '</ul>' : '') + '</li>';
    }).join('');
    var n = hits.length;
    var qq = '“' + q.trim() + '”';
    title.textContent = n ? (n === 1 ? '1 article' : n + ' articles') + ' for ' + qq : 'Nothing found for ' + qq;
    empty.hidden = n > 0;
    ol.hidden = n === 0;
    panel.hidden = false;
    status.textContent = n === 0 ? 'No articles match ' + qq + '.' : n + (n === 1 ? ' article matches ' : ' articles match ') + qq + '.';
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
  }

  function syncUrl(q) {
    try {
      var u = new URL(window.location.href);
      if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* history unavailable: the search still works */ }
  }

  if (form && input && panel && status) {
    var timer = 0;
    var run = function () {
      var q = input.value;
      load().then(function () { renderResults(q); syncUrl(q.trim()); }).catch(function () {
        status.textContent = 'Search is unavailable right now. Browse the articles below.';
      });
    };
    input.addEventListener('focus', function () { load().catch(function () {}); });
    // a click back into the field brings the answers back (focus alone does not: Escape returns focus here)
    input.addEventListener('click', function () { if (input.value.trim() && panel.hidden) run(); });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 100); });
    form.addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(timer); run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!panel.hidden) { e.preventDefault(); close(); return; }
        if (input.value) { e.preventDefault(); input.value = ''; run(); }
      }
      if (e.key === 'ArrowDown') { var first = $('a', panel); if (first && !panel.hidden) { e.preventDefault(); first.focus(); } }
    });
    // inside the panel: Escape goes back to the question, arrows move between the links
    panel.addEventListener('keydown', function (e) {
      var links = $$('a, button', panel);
      var i = links.indexOf(doc.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(); input.focus(); }
      else if (e.key === 'ArrowDown' && i > -1) { e.preventDefault(); (links[i + 1] || links[i]).focus(); }
      else if (e.key === 'ArrowUp' && i > -1) { e.preventDefault(); if (i === 0) input.focus(); else links[i - 1].focus(); }
    });
    var clear = $('[data-bresults-clear]', panel);
    if (clear) clear.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
    // a click or a focus outside the box puts the panel away (the question stays in the field)
    doc.addEventListener('pointerdown', function (e) { if (!panel.hidden && !box.contains(e.target)) close(); });
    doc.addEventListener('focusin', function (e) { if (!panel.hidden && !box.contains(e.target)) close(); });
    // "/" jumps to the question box (not while typing in a field)
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      input.focus();
    });
    // /blog/?q=… (from the search on other pages, or a shared link) runs on load
    var initial = new URLSearchParams(window.location.search).get('q');
    if (initial) { input.value = initial; run(); }
  }

  /* ---------- table of contents: the section on screen, and how much of it has been read ---------- */
  var toc = $('[data-btoc]');
  var tocLinks = toc ? $$('a[href^="#"]', toc) : [];
  var targets = tocLinks.map(function (a) { return doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
  var prose = $('[data-bprose]');
  if (toc && prose && targets.every(Boolean)) {
    tocLinks.forEach(function (a) {
      var fill = doc.createElement('span');
      fill.className = 'btoc__fill';
      fill.setAttribute('aria-hidden', 'true');
      a.appendChild(fill);
    });
    var current = -1;
    var tocTick = false;
    var updateToc = function () {
      tocTick = false;
      var line = window.innerHeight * 0.32;
      var tops = targets.map(function (t) { return t.getBoundingClientRect().top; });
      var end = prose.getBoundingClientRect().bottom;
      var active = 0;
      for (var i = 0; i < tops.length; i++) {
        if (tops[i] <= line) active = i;
        var next = i + 1 < tops.length ? tops[i + 1] : end;
        var p = (line - tops[i]) / Math.max(1, next - tops[i]);
        tocLinks[i].parentNode.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(3));
      }
      if (active !== current) {
        current = active;
        tocLinks.forEach(function (a, k) { if (k === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      }
    };
    window.addEventListener('scroll', function () { if (!tocTick) { tocTick = true; requestAnimationFrame(updateToc); } }, { passive: true });
    window.addEventListener('resize', updateToc, { passive: true });
    updateToc();
  }
  // the inline TOC (phones and tablets) closes BEFORE the jump: closing it after would pull the page up by the list's
  // height and miss the heading
  var inlineToc = $('[data-btoc-inline]');
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

  /* ---------- reading progress + cover drift (one scroll handler, one frame) ---------- */
  var bar = $('[data-bprog]');
  var cover = $('.bcover__img, .bpcover__img');
  var coverBox = cover && cover.closest('.bcover, .bpcover');
  var drift = !!(cover && coverBox && !reduceMotion && mq('(hover: hover) and (pointer: fine)') && mq('(min-width: 768px)'));
  if (bar || drift) {
    var ticking = false;
    var update = function () {
      ticking = false;
      if (bar && prose) {
        var r = prose.getBoundingClientRect();
        var total = r.height - window.innerHeight * 0.6;
        var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }
      if (drift) {
        var b = coverBox.getBoundingClientRect();
        if (b.bottom > 0) cover.style.setProperty('--drift', Math.round(Math.min(b.height, -b.top) * 0.18) + 'px');
      }
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
