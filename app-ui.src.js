/* ==========================================================================
   app-ui.js — presentation layer
   Adds bottom navigation, guided steps, touch steppers and the result hero.
   It NEVER touches calculation logic: it only moves/annotates existing DOM.
   Runs after the main app script on DOMContentLoaded.
   ========================================================================== */
(function () {
  'use strict';
  var doc = document;
  var body = doc.body;

  var WIZARDS = [];
  var TOOLS = [
    { id: 'concrete',  icon: 'box',                   key: 'tabConcrete'  },
    { id: 'blocks',    icon: 'layout-grid',            key: 'tabBlocks'    },
    { id: 'bricks',    icon: 'brick-wall',             key: 'tabBricks'    },
    { id: 'steel',     icon: 'git-commit-horizontal',  key: 'tabSteel'     },
    { id: 'earthwork', icon: 'mountain-snow',          key: 'tabEarthwork' }
  ];

  // The translation table lives inside the app script's scope, so read strings
  // back off the DOM: every translatable string has a [data-lang] carrier that
  // applyTranslations() keeps current. That keeps the UI layer localised too.
  var t = function (key, fallback) {
    var el = doc.querySelector('[data-lang="' + key + '"]');
    var txt = el ? el.textContent.trim() : '';
    return txt || fallback;
  };

  /* -------------------------------------------------- 1. bottom nav bar --- */
  function buildBottomNav() {
    var nav = doc.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottom-nav';
    nav.setAttribute('aria-label', 'Calculators');

    nav.appendChild(navButton({ id: 'home', key: 'homeBack', icon: 'layers', label: function () { return t('homeBack', 'All tools'); } }));
    TOOLS.forEach(function (tool) {
      nav.appendChild(navButton({
        id: tool.id, icon: tool.icon, key: tool.key,
        label: function () { return t(tool.key, tool.id); }
      }));
    });
    nav.appendChild(navButton({
      id: 'grandtotal', icon: 'file-text', key: 'projectTotalNav',
      label: function () { return t('projectTotalNav', 'Project Total'); },
      action: function () { if (window.openGrandTotal) window.openGrandTotal(); },
      badgeId: 'nav-total-count'
    }));
    body.appendChild(nav);

    function navButton(cfg) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'bn-item';
      b.setAttribute('data-goto', cfg.id);
      b.setAttribute('data-lang-key', cfg.key);
      b.innerHTML =
        '<span class="bn-icon"><svg class="lucide" aria-hidden="true"><use href="#i-' + cfg.icon + '"></use></svg></span>' +
        '<span></span>';
      b.querySelector('span:last-child').textContent = cfg.label();
      if (cfg.badgeId) {
        var badge = doc.createElement('span');
        badge.className = 'bn-badge';
        badge.id = cfg.badgeId;
        b.appendChild(badge);
      }
      b.addEventListener('click', function () {
        if (navigator.vibrate) navigator.vibrate(18);
        if (cfg.action) { cfg.action(); }
        else if (cfg.id === 'home') { window.goHomeUI ? window.goHomeUI() : location.reload(); }
        else { window.openToolUI ? window.openToolUI(cfg.id) : null; }
      });
      return b;
    }
    return nav;
  }

  /* ---------------------------------------- 2. contextual action bar ----- */
  function buildActionBar() {
    if (doc.getElementById('mobile-actions')) return;

    var bar = doc.createElement('div');
    bar.className = 'mobile-actions';
    bar.id = 'mobile-actions';

    var reset = doc.createElement('button');
    reset.type = 'button';
    reset.className = 'ma-icon';
    reset.id = 'mobile-reset';
    reset.setAttribute('data-lang-aria', 'resetFormLabel');
    reset.setAttribute('aria-label', t('resetBtn', 'Reset'));
    reset.innerHTML = '<svg class="lucide" aria-hidden="true"><use href="#i-rotate-ccw"></use></svg>';

    var calc = doc.createElement('button');
    calc.type = 'button';
    calc.className = 'btn btn-primary ma-primary';
    calc.id = 'mobile-calculate';
    calc.innerHTML = '<span data-lang="calculateBtn"></span>';
    calc.querySelector('span').textContent = t('calculateBtn', 'Calculate');

    bar.appendChild(reset);
    bar.appendChild(calc);
    body.appendChild(bar);
  }

  /* ------------------------------------------------------- 3. steppers --- */
  var STEPPER_SKIP = { wastage: 1 };

  function addSteppers(root) {
    var inputs = root.querySelectorAll('input[type="number"]');
    Array.prototype.forEach.call(inputs, function (input) {
      if (input.parentElement && input.parentElement.classList.contains('num-field')) return;
      if (STEPPER_SKIP[input.id]) return;
      if (input.type === 'hidden') return;

      var step = parseFloat(input.getAttribute('step'));
      if (!isFinite(step) || step <= 0) step = (input.getAttribute('step') || '').indexOf('.') >= 0 ? 0.01 : 1;
      var min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
      var max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;

      var wrap = doc.createElement('div');
      wrap.className = 'num-field';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      var box = doc.createElement('div');
      box.className = 'num-stepper';
      box.innerHTML =
        '<button type="button" data-dir="-1" aria-label="Decrease">−</button>' +
        '<button type="button" data-dir="1" aria-label="Increase">+</button>';
      wrap.appendChild(box);

      box.addEventListener('click', function (e) {
        if (navigator.vibrate) navigator.vibrate(10);
        var b = e.target.closest('button[data-dir]');
        if (!b) return;
        e.preventDefault();
        var dir = parseFloat(b.getAttribute('data-dir'));
        var cur = parseFloat(input.value);
        if (!isFinite(cur)) cur = isFinite(min) ? min : 0;
        var next = Math.round((cur + dir * step) * 1000) / 1000;
        if (next < min) next = min;
        if (next > max) next = max;
        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (navigator.vibrate) navigator.vibrate(8);
      });
    });
  }

  /* --------------------------------------------- 4. segmented radios ----- */
  function markSegments(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[role="radiogroup"]'), function (group) {
      var labels = Array.prototype.slice.call(group.querySelectorAll('label'));
      var sync = function () {
        labels.forEach(function (l) {
          var r = l.querySelector('input[type="radio"]');
          l.classList.toggle('seg-on', !!(r && r.checked));
        });
      };
      labels.forEach(function (l) {
        var r = l.querySelector('input[type="radio"]');
        if (r) r.addEventListener('change', sync);
      });
      sync();
    });
  }

  /* -------------------------------------------------------- 5. wizard ---- */
  // "1. " / "1) " in Latin, Arabic-Indic (١) and Extended Arabic-Indic (۱)
  var NUM_PREFIX = /^\s*[\u0660-\u0669\u06F0-\u06F90-9]+\s*[\.\)\-\u00B7]\s*/;

  function stepIndexOf(card) {
    var h = card.querySelector('h3');
    var m = h ? /^\s*(\d+)\s*[\.\)]/.exec(h.textContent) : null;
    if (m) return parseInt(m[1], 10);
    var keyed = card.querySelector('[data-lang^="step"]');
    if (keyed) {
      var mm = /^step(\d+)/.exec(keyed.getAttribute('data-lang') || '');
      if (mm) return parseInt(mm[1], 10);
    }
    return null;
  }

  function stepTitle(card) {
    var h = card.querySelector('h3');
    if (h) return h.textContent.replace(NUM_PREFIX, '').trim();
    var keyed = card.querySelector('[data-lang^="step"]');
    return keyed ? keyed.textContent.replace(NUM_PREFIX, '').trim() : '';
  }

  function buildWizard(tabEl) {
    if (tabEl.querySelector('.wizard')) return null;

    var found = Array.prototype.filter.call(tabEl.querySelectorAll('.card'), function (el) {
      return stepIndexOf(el) !== null;
    });
    // drop cards nested inside another step card, then group by their shared parent
    var top = found.filter(function (c) {
      return !found.some(function (o) { return o !== c && o.contains(c); });
    });
    if (top.length < 2) return null;     // one section: leave it as a plain page
    var container = top[0].parentElement;
    var cards = Array.prototype.filter.call(container.children, function (el) {
      return top.indexOf(el) !== -1;
    });

    var groups = {};
    cards.forEach(function (c) {
      var n = stepIndexOf(c);
      (groups[n] = groups[n] || []).push(c);
    });
    var numbers = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });

    // The "calculate by" radio group belongs with step 1
    var modeRadios = tabEl.querySelector('[role="radiogroup"][aria-labelledby^="calcmode"]');
    var modeWrap = modeRadios ? modeRadios.closest('div.mb-2') || modeRadios.parentElement : null;

    var wizard = doc.createElement('div');
    wizard.className = 'wizard';
    container.insertBefore(wizard, cards[0]);        // always inside the container

    var progress = doc.createElement('div');
    progress.className = 'wizard-progress';
    numbers.forEach(function () { progress.appendChild(doc.createElement('div')).className = 'wp-seg'; });
    wizard.appendChild(progress);

    var meta = doc.createElement('div');
    meta.className = 'wizard-meta';
    var metaLabel = doc.createElement('span');
    var metaTitle = doc.createElement('span');
    meta.appendChild(metaLabel); meta.appendChild(metaTitle);
    wizard.appendChild(meta);

    var stepsHost = doc.createElement('div');
    wizard.appendChild(stepsHost);

    var stepEls = numbers.map(function (n, i) {
      var sec = doc.createElement('section');
      sec.className = 'wizard-step';
      sec.setAttribute('data-step', String(i));
      if (i === 0 && modeWrap) sec.appendChild(modeWrap);
      groups[n].forEach(function (c) { sec.appendChild(c); });
      stepsHost.appendChild(sec);
      return { el: sec, cardEl: groups[n][0], title: stepTitle(groups[n][0]) };
    });

    var nav = doc.createElement('div');
    nav.className = 'wizard-nav';
    var back = doc.createElement('button');
    back.type = 'button'; back.className = 'btn btn-secondary';
    var next = doc.createElement('button');
    next.type = 'button'; next.className = 'btn btn-primary';
    nav.appendChild(back); nav.appendChild(next);
    wizard.appendChild(nav);

    // Anything left in the old container (session table etc.) stays visible.
    var leftovers = Array.prototype.filter.call(container.children, function (el) {
      return el.classList.contains('card') && stepIndexOf(el) === null;
    });
    leftovers.forEach(function (el) { container.insertBefore(el, wizard.nextSibling); });

    var current = 0;
    function render() {
      stepEls.forEach(function (s, i) { s.el.classList.toggle('is-current', i === current); });
      Array.prototype.forEach.call(progress.children, function (seg, i) {
        seg.classList.toggle('is-current', i === current);
        seg.classList.toggle('is-done', i < current);
      });
      metaLabel.textContent = t('stepOf', 'Step') + ' \u2066' + (current + 1) + ' / ' + stepEls.length + '\u2069';
      if (stepEls[current].cardEl) stepEls[current].title = stepTitle(stepEls[current].cardEl);
      metaTitle.textContent = stepEls[current].title || '';
      back.style.display = current === 0 ? 'none' : '';
      back.textContent = t('backStep', 'Back');
      next.textContent = current === stepEls.length - 1
        ? (t('reviewStep', 'Review & calculate'))
        : (t('nextStep', 'Next'));
      if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
    }
    function go(i) {
      current = Math.max(0, Math.min(stepEls.length - 1, i));
      render();
      var top = wizard.getBoundingClientRect().top + window.pageYOffset - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
    back.addEventListener('click', function () { go(current - 1); });
    next.addEventListener('click', function () {
      if (current === stepEls.length - 1) {
        var btn = tabEl.querySelector('.sticky-action-container [id^="calculate-"], .mobile-actions [id^="calculate-"]');
        if (btn) btn.click();
        return;
      }
      go(current + 1);
    });
    render();

    return { el: wizard, go: go, render: render, count: stepEls.length };
  }

  /* --------------------------------------------------- 6. result hero ---- */
  var VOLUME = /m[\u00b3\u0f33]|ft[\u00b33]|yd[\u00b33]|c\.?f|c\.?y|ltr|l\b/i;

  // Which result row becomes the hero headline, per tool.
  var HEADLINE = {
    concrete: 'first',          // Total Volume
    earthwork: 'first',         // Total Excavation Volume
    blocks: 'firstNonVolume',   // Blocks Required
    bricks: 'firstNonVolume',   // Bricks Required
    steel: 'lastNonMoney'       // combined Total Weight
  };

  // "د.ع0.00" / "$12.34" -> money; "149340.80 kg" / "Cost not entered" -> not.
  function isMoneyLike(text) {
    return /[^\d\s]/.test(text) && /\d/.test(text) && !/^\s*[\d]/.test(text);
  }

  function rawValue(item) {
    var strong = item.querySelector('strong');
    var span = item.querySelector('span');
    if (!span) return '';
    var txt = span.textContent.trim();
    if (strong) txt = txt.replace(strong.textContent, '').trim();
    return txt;
  }

  function heroFromResult(resultEl, toolId) {
    var card = resultEl.querySelector('.result-card');
    if (!card || card.querySelector('.result-hero')) return;

    var items = Array.prototype.slice.call(card.querySelectorAll('.result-item'));
    if (!items.length) return;

    var grid = card.querySelector('.result-content > div');
    if (!grid) return;

    var totalEl = card.querySelector('.total-cost-print strong');
    var totalTxt = totalEl ? totalEl.textContent.trim() : '';
    // "Grand Total (Estimated) $12.34"  ->  label / currency / amount
    var tm = /^(.*?)\s*([^\s\d]+?)\s*([\d][\d,\.]*)\s*$/.exec(totalTxt);
    var money = tm ? tm[2] + ' ' + tm[3] : '';
    var costLabel = tm ? tm[1].replace(/\s*\([^)]*\)/g, '').trim() : '';

    // Headline = the single number the user came for. Each tool reports in a
    // different shape, so the pick is per-tool rather than one guessed rule.
    var pick = HEADLINE[toolId] || 'firstNonVolume';
    var lastItem = items[items.length - 1];
    var isMoneyItem = lastItem && isMoneyLike(rawValue(lastItem));

    var headIdx = 0;
    if (pick === 'firstNonVolume') {
      for (var i = 0; i < items.length; i++) {
        var v = itemValue(items[i]);
        if (VOLUME.test(v.unit) || v.unit.length > 14) continue;
        headIdx = i; break;
      }
    } else if (pick === 'lastNonMoney') {
      // Steel: the headline is the combined Total Weight. Skip cost rows and
      // breakdown/detail rows (with lap splices on, those sit at the end).
      headIdx = items.length - 1;
      while (headIdx > 0 &&
             (items[headIdx].getAttribute('data-kind') === 'detail' ||
              items[headIdx].getAttribute('data-kind') === 'cost' ||
              isMoneyLike(rawValue(items[headIdx])))) {
        headIdx--;
      }
    }

    // Explicit headline marker wins (steel marks its Total Weight row).
    var marked = card.querySelector('.result-item[data-hero]');
    if (marked) { var mi = items.indexOf(marked); if (mi > -1) headIdx = mi; }

    var head = items[headIdx];
    var strong = head.querySelector('strong');
    var label = strong ? strong.textContent.trim() : '';
    var parsed = itemValue(head);

    // Cost: prefer the printed grand total; steel renders it as a result row.
    if (!money && isMoneyItem && lastItem !== head) {
      var lm = /^(.*?)\s*([^\s\d]+?)\s*([\d][\d,\.]*)\s*$/.exec(rawValue(lastItem));
      if (lm) {
        money = lm[2] + ' ' + lm[3];
        var lmLabel = lm[1] || (lastItem.querySelector('strong') ? lastItem.querySelector('strong').textContent : '');
        costLabel = lmLabel.replace(/\s*\([^)]*\)/g, '').trim();
      }
    }

    var hero = doc.createElement('div');
    hero.className = 'result-hero';
    hero.innerHTML =
      '<div class="rh-label"></div>' +
      '<div class="rh-value"></div>' +
      (money ? '<div class="rh-cost"><span></span><strong></strong></div>' : '');
    hero.querySelector('.rh-label').textContent = label;
    hero.querySelector('.rh-value').textContent = groupDigits(parsed.qty) || '\u2014';
    if (parsed.unit) {
      var u = doc.createElement('span');
      u.className = 'rh-unit';
      u.textContent = parsed.unit;
      hero.querySelector('.rh-value').appendChild(u);
    }
    if (money) {
      hero.querySelector('.rh-cost span').textContent = costLabel;
      hero.querySelector('.rh-cost strong').textContent = money;
    }
    grid.insertBefore(hero, grid.firstChild);

    // Promote the save / CSV / print buttons out of the header into their own row.
    var header = card.querySelector('.result-card > .flex, .result-card > div');
    var actions = card.querySelector('.save-history-btn') || card.querySelector('.export-btn');
    if (actions && !card.querySelector('.result-actions')) {
      var tray = actions.parentElement;
      var row = doc.createElement('div');
      row.className = 'result-actions';
      Array.prototype.slice.call(tray.children).forEach(function (b) {
        b.classList.add('btn', 'btn-secondary');
        row.appendChild(b);
      });
      tray.remove();
      grid.insertBefore(row, hero.nextSibling);
    }

    // The headline and the grand total are now inside the hero, so stop showing
    // them twice. They are HIDDEN, not removed: exportToCSV() enumerates
    // .result-item, and PDF/print already shows both values inside the hero.
    head.style.display = 'none';
    head.setAttribute('aria-hidden', 'true');
    if (totalEl) {
      var tp = totalEl.closest('.total-cost-print');
      if (tp) tp.style.display = 'none';
    }
    if (money && isMoneyItem && lastItem !== head) lastItem.style.display = 'none';
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
  }

  function groupDigits(qty) {
    if (!qty || !/^[\d][\d,\.]*$/.test(qty)) return qty;
    var parts = qty.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function itemValue(item) {
    var txt = rawValue(item);
    var m = /^([\d][\d,\.]*)\s*(.*)$/.exec(txt);
    return m ? { qty: m[1], unit: m[2] } : { qty: txt, unit: '' };
  }


  /* ------------------------------------------- 6b. result organiser ---- */
  // After the hero, results used to be one flat grid of up to 23 rows.
  // Now: hero (the answer) -> "What to order" (final quantities only,
  // max 6 rows + Share) -> everything else inside a collapsed details
  // section. Cost rows with no prices entered are hidden entirely.
  // Nothing is removed from the DOM, only moved/hidden, so CSV/PDF
  // export (which enumerates .result-item) keeps working exactly as before.
  var RESULT_STRINGS = {
    en: { order: 'What to order', more: 'See details', share: 'Share list', copied: 'Copied ✓', listTitle: 'Order list', edit: 'Edit inputs', hide: 'Hide inputs' },
    ku: { order: 'لیستا کڕینێ', more: 'وردەکاری ببینە', share: 'لیستێ بەشدار بکە', copied: 'هاتە کۆپیکرن ✓', listTitle: 'لیستا کڕینێ', edit: 'گوهۆڕینا زانیارییان', hide: 'ڤەشارتن' },
    ks: { order: 'لیستی کڕین', more: 'وردەکاری ببینە', share: 'هاوبەشکردنی لیست', copied: 'کۆپی کرا ✓', listTitle: 'لیستی کڕین', edit: 'دەستکاری تێکردنەکان', hide: 'شاردنەوە' },
    ar: { order: 'قائمة الشراء', more: 'عرض التفاصيل', share: 'مشاركة القائمة', copied: 'تم النسخ ✓', listTitle: 'قائمة الشراء', edit: 'تعديل المدخلات', hide: 'إخفاء المدخلات' }
  };
  function resultStrings() {
    var lang = 'en';
    try { lang = localStorage.getItem('language') || 'en'; } catch (e) {}
    return RESULT_STRINGS[lang] || RESULT_STRINGS.en;
  }
  function itemIcon(item) {
    var use = item.querySelector('use');
    return use ? (use.getAttribute('href') || '') : '';
  }
  function isCostItem(item) {
    return /circle-dollar-sign|wallet/.test(itemIcon(item));
  }
  function organizeResult(resultEl) {
    var card = resultEl.querySelector('.result-card');
    if (!card || card.querySelector('.order-list')) return;
    var strings = resultStrings();

    var items = Array.prototype.slice.call(card.querySelectorAll('.result-item')).filter(function (it) {
      return it.style.display !== 'none' && !it.closest('.order-list') && !it.closest('.result-more');
    });
    if (!items.length) return;

    var order = [], more = [];
    items.forEach(function (it) {
      var kind = it.getAttribute('data-kind');
      if (kind === 'cost') {
        if (!/\d/.test(rawValue(it))) { it.style.display = 'none'; it.setAttribute('aria-hidden', 'true'); return; }
        more.push(it); return;
      }
      if (kind === 'detail') { more.push(it); return; }
      if (kind === 'order') { if (order.length < 6) order.push(it); else more.push(it); return; }
      if (isCostItem(it)) {
        // No prices entered -> the row only says so. Hide it (kept in DOM for export).
        if (!/\d/.test(rawValue(it))) { it.style.display = 'none'; it.setAttribute('aria-hidden', 'true'); return; }
        more.push(it); return;
      }
      var lbl = it.querySelector('strong') ? it.querySelector('strong').textContent : '';
      if (/before wast/i.test(lbl) || it.querySelector('details.calculation-trail') || it.textContent.trim().length > 140) { more.push(it); return; }
      if (order.length < 6) order.push(it); else more.push(it);
    });
    if (!order.length) return;
    var grid = order[0].parentElement;
    if (!grid) return;

    // Order rows show only the final quantity: "1.20 + 0.06 waste = 1.26 m3" -> "1.26 m3"
    order.forEach(function (it) {
      var span = it.querySelector('span');
      if (!span) return;
      var strong = span.querySelector('strong');
      var txt = rawValue(it);
      if (txt.indexOf('=') > -1 && txt.indexOf('\u00d7') === -1) {
        var finalPart = txt.split('=').pop().trim();
        span.textContent = '';
        if (strong) span.appendChild(strong);
        span.appendChild(doc.createTextNode(' ' + finalPart));
      }
      it.classList.add('order-row');
      // Keep number+unit together inside RTL sentences (never "m3 1.85" reorder).
      var sp = it.querySelector('span');
      if (sp && !sp.querySelector('bdi')) {
        var bdi = doc.createElement('bdi');
        Array.prototype.slice.call(sp.childNodes).forEach(function (n) {
          if (n !== sp.querySelector('strong')) bdi.appendChild(n);
        });
        if (bdi.textContent.trim()) sp.appendChild(bdi);
      }
    });

    var section = doc.createElement('section');
    section.className = 'order-list';
    var heading = doc.createElement('div');
    heading.className = 'order-head';
    var h = doc.createElement('h3'); h.textContent = strings.order;
    var shareBtn = doc.createElement('button');
    shareBtn.type = 'button'; shareBtn.className = 'btn btn-secondary order-share';
    shareBtn.textContent = strings.share;
    shareBtn.addEventListener('click', function () {
      var lines = [strings.listTitle];
      var hv = card.querySelector('.rh-value'), hl = card.querySelector('.rh-label');
      if (hl && hv) lines.push(hl.textContent.trim() + ': ' + hv.textContent.trim());
      order.forEach(function (it) { lines.push('- ' + it.textContent.replace(/\s+/g, ' ').trim()); });
      var cost = card.querySelector('.rh-cost strong');
      if (cost) lines.push(cost.textContent.trim());
      var text = lines.join('\n');
      var done = function () { shareBtn.textContent = strings.copied; setTimeout(function () { shareBtn.textContent = strings.share; }, 1600); };
      if (navigator.share) navigator.share({ text: text }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(function () {});
      if (navigator.vibrate) navigator.vibrate(20);
    });
    heading.appendChild(h); heading.appendChild(shareBtn);
    var rows = doc.createElement('div'); rows.className = 'order-rows';
    order.forEach(function (it) { rows.appendChild(it); });
    section.appendChild(heading); section.appendChild(rows);
    if (resultEl.id === 'steel-result') {
      var barsNote = doc.createElement('p');
      barsNote.className = 'order-note';
      barsNote.setAttribute('data-lang', 'orderBarsNote');
      barsNote.textContent = t('orderBarsNote', 'Yards sell steel as standard 12 m commercial bars — the counts above are bars to order.');
      rows.appendChild(barsNote);
    }

    grid.insertBefore(section, grid.firstChild);

    // One single collapsed section: the cost/breakdown rows AND the
    // calculation trail (flattened) live behind one "See details" tap.
    var trail = card.querySelector('details.calculation-trail');
    if (more.length || trail) {
      var details = doc.createElement('details');
      details.className = 'result-more';
      var summary = doc.createElement('summary'); summary.textContent = strings.more;
      details.appendChild(summary);
      if (more.length) {
        var moreRows = doc.createElement('div'); moreRows.className = 'order-rows';
        more.forEach(function (it) { moreRows.appendChild(it); });
        details.appendChild(moreRows);
      }
      if (trail) {
        var tsum = trail.querySelector('summary');
        var sub = doc.createElement('div');
        sub.className = 'trail-subhead';
        sub.textContent = tsum ? tsum.textContent.trim() : strings.more;
        var body = doc.createElement('div');
        body.className = 'trail-body';
        Array.prototype.slice.call(trail.childNodes).forEach(function (n) {
          if (n === tsum) return;
          body.appendChild(n);
        });
        details.appendChild(sub);
        details.appendChild(body);
        if (trail.parentNode) trail.parentNode.removeChild(trail);
      }
      grid.appendChild(details);
    }

    // Normalise the card layout: the answer -> buttons -> what to order ->
    // one collapsed details section. (Left-over rows are hidden for export.)
    var hero = card.querySelector('.result-hero');
    var actions = card.querySelector('.result-actions');
    if (hero) grid.appendChild(hero);
    if (actions) grid.appendChild(actions);
    grid.appendChild(section);
    var merged = grid.querySelector('.result-more');
    if (merged) grid.appendChild(merged);
    // Park export-only (hidden) leftovers after the visible blocks.
    Array.prototype.slice.call(grid.children).forEach(function (n) {
      if (n !== hero && n !== actions && n !== section && n !== merged) grid.appendChild(n);
    });

    card.classList.add('result-ready');
    if (navigator.vibrate) navigator.vibrate(25);
    var heroFinal = card.querySelector('.result-hero');
    if (heroFinal) setTimeout(function () { heroFinal.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }


  /* Collapse the input wizard behind an "Edit inputs" bar once a result
     exists, so on a phone the result is the page, not the form + result.
     Reset/hiding the result restores the wizard (see watchResults). */
  function collapseInputs(resultEl) {
    var tab = resultEl.closest('.tab-content');
    if (!tab) return;
    var wizard = tab.querySelector('.wizard');
    if (!wizard || resultEl.querySelector('.edit-inputs-bar')) return;
    var strings = resultStrings();
    wizard.classList.add('wizard-collapsed');
    var bar = doc.createElement('div');
    bar.className = 'edit-inputs-bar';
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary edit-inputs-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '\u270e ' + strings.edit;
    btn.addEventListener('click', function () {
      var collapsed = wizard.classList.toggle('wizard-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.textContent = collapsed ? '\u270e ' + strings.edit : strings.hide;
      if (!collapsed) setTimeout(function () { wizard.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
    });
    bar.appendChild(btn);
    resultEl.insertBefore(bar, resultEl.firstChild);
  }
  function restoreInputs(resultEl) {
    var tab = resultEl.closest('.tab-content');
    if (!tab) return;
    var wizard = tab.querySelector('.wizard');
    if (wizard) wizard.classList.remove('wizard-collapsed');
    var bar = resultEl.querySelector('.edit-inputs-bar');
    if (bar) bar.remove();
  }

  function watchResults() {
    ['concrete', 'blocks', 'bricks', 'steel', 'earthwork'].forEach(function (type) {
      var target = doc.getElementById(type + '-result');
      if (!target) return;
      var run = function () {
        if (target.classList.contains('hidden')) { restoreInputs(target); return; }
        if (!target.querySelector('.result-card')) return;
        try { heroFromResult(target, type); organizeResult(target); collapseInputs(target); } catch (e) { console.error('result organiser:', e); }
      };
      new MutationObserver(run).observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ------------------------------------------------------------- boot ---- */
  function init() {
    initMobileKeyboard();
    buildBottomNav();
    buildActionBar();

    ['concrete', 'blocks', 'bricks', 'steel', 'earthwork'].forEach(function (id) {
      var tab = doc.getElementById(id);
      if (!tab) return;
      addSteppers(tab);
      markSegments(tab);
      var wiz = buildWizard(tab);
      if (wiz) { tab.__wizard = wiz; WIZARDS.push(wiz); }
    });

    // Soft-keyboard flow per card: every typed field advances with "next",
    // the card's last field closes the keyboard with "done".
    doc.querySelectorAll('main .card').forEach(function (card) {
      var fields = Array.prototype.slice.call(card.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'));
      fields.forEach(function (el, i) {
        el.setAttribute('enterkeyhint', i === fields.length - 1 ? 'done' : 'next');
      });
    });

    // v63 quick picks: one delegated handler fills engineering values, marks
    // the fields (focus will select) and confirms the tap with a soft tick.
    doc.addEventListener('click', function (e) {
      var chip = e.target && e.target.closest && e.target.closest('.chip-btn[data-fill]');
      if (!chip) return;
      if (navigator.vibrate) navigator.vibrate(10);
      chip.getAttribute('data-fill').split(';').forEach(function (pair) {
        var kv = pair.split(':');
        var el = doc.getElementById(kv[0]);
        if (!el) return;
        el.value = kv[1];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dataset.presetFilled = '1';
      });
    });

    // v63 soil types: picking a soil fills the swell factor (excavation only).
    var soilSel = doc.getElementById('earthwork-soil-type');
    var swellEl = doc.getElementById('earthwork-swell');
    if (soilSel) {
      soilSel.addEventListener('change', function () {
        if (soilSel.value !== '' && swellEl) {
          swellEl.value = soilSel.value;
          swellEl.dispatchEvent(new Event('input', { bubbles: true }));
          swellEl.dataset.presetFilled = '1';
        }
        if (navigator.vibrate) navigator.vibrate(10);
      });
    }
    if (swellEl) {
      swellEl.addEventListener('input', function () {
        if (soilSel && soilSel.value !== swellEl.value) soilSel.value = '';
      });
    }
    var syncSoilPicks = function () {
      var back = doc.querySelector('input[name="earthwork-mode"][value="backfill"]');
      var picks = doc.getElementById('earthwork-soil-picks');
      if (picks && back) picks.classList.toggle('hidden', back.checked);
    };
    doc.querySelectorAll('input[name="earthwork-mode"]').forEach(function (r) {
      r.addEventListener('change', syncSoilPicks);
    });
    syncSoilPicks();

    // v63 micro: typing replaces preset/default values (select on focus).
    doc.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      if (el.type !== 'number' && el.type !== 'text' && el.type !== 'search') return;
      if (el.dataset.presetFilled === '1' || (el.value !== '' && el.value === el.getAttribute('value'))) {
        el.select();
      }
    });
    doc.addEventListener('input', function (e) {
      if (e.target && e.target.dataset) delete e.target.dataset.presetFilled;
    });

    // v63 micro: quick clear (x) inside text fields so gloved hands can zero them.
    doc.querySelectorAll('input[type="text"], input[type="search"]').forEach(function (el) {
      if (el.readOnly || el.closest('.input-clear-wrap')) return;
      var wrap = doc.createElement('span');
      wrap.className = 'input-clear-wrap';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'input-clear-btn';
      btn.setAttribute('data-lang-aria', 'menuClose');
      btn.setAttribute('aria-label', 'Clear');
      btn.innerHTML = '<svg class="lucide lucide-default" aria-hidden="true" focusable="false"><use href="#i-x"></use></svg>';
      btn.addEventListener('click', function () {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
      });
      wrap.appendChild(btn);
    });

    // v63 micro: the site crew must know the app will work underground/offline.
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function () {
        var pill = doc.getElementById('offline-pill');
        if (pill) pill.classList.remove('hidden');
      });
    }

    /* v63 spec previews: lightweight SVG diagrams so a mistyped Length/Thickness
       is visible at a glance. currentColor + CSS vars — RTL and dark-mode safe. */
    function svgOpen(title) {
      return '<svg class="spec-svg" viewBox="0 0 320 190" role="img" aria-label="' + title + '">' +
        '<rect x="0" y="0" width="320" height="190" rx="10" fill="none"></rect>';
    }
    function specNum(id) {
      var el = doc.getElementById(id);
      var v = el ? parseFloat(el.value) : NaN;
      return Number.isFinite(v) ? v : 0;
    }
    function specText(x, y, str, anchor) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') +
        '" font-size="10" fill="currentColor" opacity="0.85">' + str + '</text>';
    }
    function beamSectionSVG() {
      var w = specNum('beam-width-dim') || 300, d = specNum('beam-depth-dim') || 500;
      var cover = specNum('beam-cover') || 40;
      var bars = Math.max(2, Math.round(specNum('beam-bars') || 2));
      var dia = specNum('beam-diameter') || 12;
      var stirrups = (doc.getElementById('beam-include-stirrups') || {}).checked;
      var sp = specNum('beam-stirrup-spacing') || 0;
      var sDia = specNum('beam-stirrup-diameter') || 8;
      var boxW = 210, boxH = 130;
      var sc = Math.min(boxW / w, boxH / d);
      var rw = w * sc, rh = d * sc;
      var x0 = 160 - rw / 2, y0 = 22 + (boxH - rh) / 2;
      var cPx = Math.max(3, cover * sc);
      var out = svgOpen('steel section');
      out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + rw + '" height="' + rh + '" rx="3" class="spec-concrete"></rect>';
      if (stirrups) out += '<rect x="' + (x0 + cPx) + '" y="' + (y0 + cPx) + '" width="' + (rw - 2 * cPx) + '" height="' + (rh - 2 * cPx) + '" rx="3" class="spec-stirrup"></rect>';
      var top = Math.ceil(bars / 2), bot = Math.floor(bars / 2);
      var i, t, cx, cy;
      for (i = 0; i < top; i++) {
        cx = x0 + cPx + (rw - 2 * cPx) * (i + 1) / (top + 1);
        cy = y0 + cPx;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="4.2" class="spec-bar"></circle>';
      }
      for (i = 0; i < bot; i++) {
        cx = x0 + cPx + (rw - 2 * cPx) * (i + 1) / (bot + 1);
        cy = y0 + rh - cPx;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="4.2" class="spec-bar"></circle>';
      }
      t = bars + '-\u00d8' + dia;
      out += specText(160, 16, t);
      if (stirrups && sp > 0) out += specText(160, 182, '\u00d8' + sDia + ' @ ' + sp + ' mm');
      out += specText(x0 - 8, y0 + rh / 2, cover + ' mm', 'end');
      out += '<line x1="' + (x0 - 5) + '" y1="' + (y0 + 2) + '" x2="' + (x0 - 5) + '" y2="' + (y0 + cPx) + '" class="spec-dim"></line>';
      out += '</svg>';
      return out;
    }
    function gridPlanSVG() {
      var kind = (doc.getElementById('steel-element-selector') || {}).value || 'footing';
      var L, W, spL, spW, dL, dW;
      if (kind === 'one_way') {
        L = specNum('one-way-bar-length') || 6000; W = specNum('one-way-dist-length') || 5000;
        spL = specNum('one-way-spacing') || 200; spW = spL; dL = specNum('one-way-diameter') || 12; dW = dL;
      } else {
        var pre = kind === 'slab' ? 'slab' : 'footing';
        L = specNum(pre + '-length') || 3000; W = specNum(pre + '-width') || 2000;
        spL = specNum(pre + '-spacing-len') || 200; spW = specNum(pre + '-spacing-wid') || 200;
        dL = specNum(pre + '-diameter-len') || 12; dW = specNum(pre + '-diameter-wid') || 12;
      }
      var boxW = 250, boxH = 128;
      var sc = Math.min(boxW / L, boxH / W);
      var rw = Math.max(40, L * sc), rh = Math.max(30, W * sc);
      var x0 = 160 - rw / 2, y0 = 30 + (boxH - rh) / 2;
      var out = svgOpen('rebar grid');
      out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + rw + '" height="' + rh + '" rx="3" class="spec-concrete"></rect>';
      var i, n;
      if (spL > 0) {
        n = Math.min(24, Math.max(1, Math.round(L / spL)));
        for (i = 1; i <= n; i++) {
          var gx = x0 + rw * i / (n + 1);
          out += '<line x1="' + gx + '" y1="' + (y0 + 2) + '" x2="' + gx + '" y2="' + (y0 + rh - 2) + '" class="spec-bar-line"></line>';
        }
      }
      if (spW > 0) {
        n = Math.min(24, Math.max(1, Math.round(W / spW)));
        for (i = 1; i <= n; i++) {
          var gy = y0 + rh * i / (n + 1);
          out += '<line x1="' + (x0 + 2) + '" y1="' + gy + '" x2="' + (x0 + rw - 2) + '" y2="' + gy + '" class="spec-bar-line alt"></line>';
        }
      }
      out += specText(160, 16, '\u00d8' + dL + ' @ ' + spL + ' mm');
      out += specText(160, 182, '\u00d8' + dW + ' @ ' + spW + ' mm');
      out += '</svg>';
      return out;
    }
    function drawPreviews() {
      var steelBox = doc.getElementById('steel-spec-preview');
      if (steelBox) {
        var kind = (doc.getElementById('steel-element-selector') || {}).value || 'beam';
        if (kind === 'custom' || kind === 'brc') steelBox.innerHTML = '';
        else steelBox.innerHTML = kind === 'beam' ? beamSectionSVG() : gridPlanSVG();
      }
    }
    var drawQueued = false;
    function queueDraw() {
      if (drawQueued) return;
      drawQueued = true;
      requestAnimationFrame(function () { drawQueued = false; drawPreviews(); });
    }
    ['steel'].forEach(function (id) {
      var tab = doc.getElementById(id);
      if (tab) ['input', 'change'].forEach(function (ev) { tab.addEventListener(ev, queueDraw); });
    });
    queueDraw();

    watchResults();

    // Expose the same verbs the home tiles use, so the bottom nav can reuse them.
    window.goHomeUI = function () {
      var back = doc.getElementById('back-home-btn');
      if (back) back.click();
      else { body.classList.add('view-home'); }
    };
    window.openToolUI = function (toolId) {
      var tile = doc.querySelector('.app-tile[data-goto="' + toolId + '"]');
      if (tile) tile.click();
    };

    // PWA install: show the home button when the browser defers the prompt
    var deferredInstall = null;
    var installBtn = doc.getElementById('install-app-btn');
    if (installBtn) {
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredInstall = e;
        installBtn.classList.remove('hidden');
      });
      window.addEventListener('appinstalled', function () {
        installBtn.classList.add('hidden');
        deferredInstall = null;
      });
      installBtn.addEventListener('click', function () {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') installBtn.classList.add('hidden');
          deferredInstall = null;
        });
      });
    }

    function syncNav() {
      var active = doc.querySelector('.tab-btn.tab-active');
      Array.prototype.forEach.call(doc.querySelectorAll('.bn-item'), function (b) {
        var on = active && b.getAttribute('data-goto') === active.dataset.tab;
        b.classList.toggle('is-active', !!on);
        b.setAttribute('aria-current', on ? 'page' : 'false');
      });
    }
    // Sync straight away (same tick) and once more after the app's own handler
    // has swapped the active tab, so the nav is correct either way.
    doc.addEventListener('click', function () { syncNav(); setTimeout(syncNav, 0); });
    syncNav();

    // Re-read every string when the language changes (applyTranslations runs first).
    function refreshLang() {
      Array.prototype.forEach.call(doc.querySelectorAll('.bn-item'), function (b) {
        var lbl = b.querySelector('span:last-child');
        if (lbl) lbl.textContent = t(b.getAttribute('data-lang-key'), lbl.textContent);
      });
      WIZARDS.forEach(function (w) { w.render(); });
      syncNav();
    }
    doc.addEventListener('change', function (e) {
      if (e.target && e.target.id !== 'language-selector') return;
      setTimeout(refreshLang, 0);
    });
    // The main app applies the saved language on DOMContentLoaded and emits
    // 'app:lang' — without this, nav/wizard labels stay in English on phones.
    doc.addEventListener('app:lang', function () { setTimeout(refreshLang, 0); });
  }

  /* Mobile keyboard: hide bottom nav while typing, and give phone
     keyboards the right action key (Next/Done) on every field. */
  function initMobileKeyboard() {
    Array.prototype.forEach.call(doc.querySelectorAll('input, select, textarea'), function (el) {
      if (!el.getAttribute('enterkeyhint')) {
        el.setAttribute('enterkeyhint', (el.tagName === 'SELECT' || el.type === 'text') ? 'next' : 'done');
      }
      if (!el.name && el.id) el.name = el.id;
    });
    if (!window.visualViewport) return;
    var vv = window.visualViewport;
    var onResize = function () {
      var open = (window.innerHeight - vv.height) > 150;
      doc.body.classList.toggle('keyboard-open', open);
    };
    vv.addEventListener('resize', onResize);
    onResize();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
