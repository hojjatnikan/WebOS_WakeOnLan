/*
 * Remote-control navigation.
 *
 * A webOS app is driven by five buttons and no pointer, and the browser's own
 * focus handling is not enough on its own: text inputs would pop the on-screen
 * keyboard the moment the cursor passes over them, and there is no way to know
 * where "down" should land in a wrapping card grid.
 *
 * So navigation is done explicitly. Focus is a `.focused` class moved by
 * geometric search - from the current element, pick the candidate in the
 * pressed direction with the smallest weighted distance, where the distance
 * perpendicular to travel counts double. That keeps movement inside a row or
 * column whenever one exists, which is what people expect from a TV grid.
 *
 * The native input focus is deliberately NOT moved during navigation. It is
 * moved only when the user presses Enter on a text field, which is the
 * deliberate gesture that should raise the platform keyboard.
 *
 * Scopes form a stack. The app root is the bottom scope with the Back action
 * bound to "exit"; a modal pushes a scope whose Back action closes it, so the
 * Back key unwinds exactly one layer at a time.
 */

(function (global) {
  'use strict';

  var KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    SPACE: 32,
    TAB: 9,
    BACK: 461,
    ESCAPE: 27
  };

  var FOCUS_CLASS = 'focused';
  var scopes = [];
  var backFallback = null;
  var enabled = true;

  var DIRECTION_BY_KEY = {};
  DIRECTION_BY_KEY[KEY.LEFT] = 'left';
  DIRECTION_BY_KEY[KEY.UP] = 'up';
  DIRECTION_BY_KEY[KEY.RIGHT] = 'right';
  DIRECTION_BY_KEY[KEY.DOWN] = 'down';

  /* ------------------------------------------------------------- geometry */

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.getClientRects().length === 0) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function focusables(container) {
    var found = container.querySelectorAll('[data-nav]');
    var out = [];
    for (var i = 0; i < found.length; i++) {
      if (isVisible(found[i])) out.push(found[i]);
    }
    return out;
  }

  function centerOf(el) {
    var rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // null when the candidate is not in the requested direction at all.
  function directionalScore(candidate, origin, direction) {
    var c = centerOf(candidate);
    var o = centerOf(origin);
    var dx = c.x - o.x;
    var dy = c.y - o.y;

    if (direction === 'left' && dx > -2) return null;
    if (direction === 'right' && dx < 2) return null;
    if (direction === 'up' && dy > -2) return null;
    if (direction === 'down' && dy < 2) return null;

    var alongTrack = (direction === 'left' || direction === 'right') ? Math.abs(dx) : Math.abs(dy);
    var acrossTrack = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);

    return alongTrack + acrossTrack * 2;
  }

  function findInDirection(origin, direction, candidates) {
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] === origin) continue;
      var score = directionalScore(candidates[i], origin, direction);
      if (score === null) continue;
      if (score < bestScore) {
        bestScore = score;
        best = candidates[i];
      }
    }
    return best;
  }

  /* ------------------------------------------------------------ scrolling */

  function scrollableAncestor(el, boundary) {
    var node = el.parentNode;
    while (node && node.nodeType === 1) {
      var style = global.getComputedStyle(node);
      var overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
        return node;
      }
      if (node === boundary) break;
      node = node.parentNode;
    }
    return null;
  }

  // scrollIntoView({block:'nearest'}) is not available on the older Chromium
  // builds these TVs run, and on those builds the call scrolls to the top
  // instead of doing nothing - so the scrolling is done by hand.
  function ensureVisible(el) {
    var scope = currentScope();
    var boundary = scope ? scope.container : document.body;
    var scroller = scrollableAncestor(el, boundary);
    if (!scroller) return;

    var rect = el.getBoundingClientRect();
    var view = scroller.getBoundingClientRect();
    var margin = 28;

    if (rect.top < view.top + margin) {
      scroller.scrollTop -= (view.top + margin - rect.top);
    } else if (rect.bottom > view.bottom - margin) {
      scroller.scrollTop += (rect.bottom - (view.bottom - margin));
    }
  }

  /* --------------------------------------------------------------- scopes */

  function currentScope() {
    return scopes.length ? scopes[scopes.length - 1] : null;
  }

  function clearFocusClass() {
    var marked = document.querySelectorAll('.' + FOCUS_CLASS);
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove(FOCUS_CLASS);
  }

  function focus(el, options) {
    if (!el) return;
    var scope = currentScope();
    if (scope) scope.lastFocused = el;

    clearFocusClass();
    el.classList.add(FOCUS_CLASS);

    // A table row and its "Add" button are separate focus targets; marking the
    // row as well makes the highlight readable across the whole width.
    var row = el.closest ? el.closest('tr') : null;
    if (row) row.classList.add('row-focus');

    if (!options || options.scroll !== false) ensureVisible(el);
  }

  function focusFirst(container, preferred) {
    var candidates = focusables(container);
    if (!candidates.length) return null;
    var target = preferred && candidates.indexOf(preferred) !== -1 ? preferred : candidates[0];
    focus(target);
    return target;
  }

  function pushScope(container, options) {
    var opts = options || {};
    scopes.push({
      container: container,
      onBack: opts.onBack || null,
      lastFocused: null
    });

    // A scope opened on top of the current one must not inherit the highlight.
    clearFocusClass();

    var initial = opts.initial && isVisible(opts.initial)
      ? opts.initial
      : (focusables(container)[0] || null);
    if (initial) focus(initial, { scroll: false });
    return currentScope();
  }

  function popScope() {
    if (scopes.length <= 1) return null;
    var removed = scopes.pop();
    clearFocusClass();
    var restore = removed.lastFocused && isVisible(removed.lastFocused) ? removed.lastFocused : null;
    focusFirst(currentScope().container, restore);
    return currentScope();
  }

  // Content changed under the highlight (a card was deleted, a table re-drawn):
  // keep the user roughly where they were rather than dropping focus entirely.
  function refresh(preferred) {
    var scope = currentScope();
    if (!scope) return;

    if (preferred && isVisible(preferred)) return focus(preferred, { scroll: false });

    var candidates = focusables(scope.container);
    if (!candidates.length) return;

    if (scope.lastFocused && candidates.indexOf(scope.lastFocused) !== -1) {
      return focus(scope.lastFocused, { scroll: false });
    }

    // Fall back to the element closest to where the highlight used to be.
    var anchor = scope.lastFocused;
    if (!anchor) return focus(candidates[0], { scroll: false });

    var anchorCenter = centerOf(anchor);
    var best = candidates[0];
    var bestDistance = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var c = centerOf(candidates[i]);
      var d = Math.abs(c.x - anchorCenter.x) + Math.abs(c.y - anchorCenter.y);
      if (d < bestDistance) { bestDistance = d; best = candidates[i]; }
    }
    focus(best, { scroll: false });
  }

  /* ------------------------------------------------------------ activation */

  function isTextEntry(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag !== 'input') return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === 'number' || type === 'search' || type === 'url';
  }

  // Enter on a text field raises the platform keyboard; on anything else it is
  // a click.
  function activate(el) {
    if (!el) return;
    if (isTextEntry(el)) {
      try {
        global.focus();
        el.focus();
        if (el.setSelectionRange && typeof el.value === 'string') {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      } catch (e) { /* keyboard may be unavailable */ }
      return;
    }
    try {
      el.click();
    } catch (e) { /* nothing else to do */ }
  }

  /* ---------------------------------------------------------------- exit */

  function exitApp() {
    if (global.webOS && typeof global.webOS.platformBack === 'function') {
      try { global.webOS.platformBack(); return; } catch (e) { /* fall through */ }
    }
    try { global.close(); } catch (e) { /* the platform will handle it */ }
  }

  function handleBack() {
    var scope = currentScope();
    if (scope && scope.onBack) {
      scope.onBack();
      return;
    }
    if (backFallback) {
      backFallback();
      return;
    }
    if (scopes.length > 1) {
      popScope();
      return;
    }
    exitApp();
  }

  /* -------------------------------------------------------------- events */

  function onKeyDown(event) {
    if (!enabled) return;

    var code = event.keyCode || event.which;
    var scope = currentScope();
    if (!scope) return;

    if (code === KEY.BACK || code === KEY.ESCAPE) {
      event.preventDefault();
      handleBack();
      return;
    }

    var candidates = focusables(scope.container);
    if (!candidates.length) return;

    var current = document.querySelector('.' + FOCUS_CLASS);
    if (!current || candidates.indexOf(current) === -1) {
      event.preventDefault();
      focus(candidates[0]);
      return;
    }

    var direction = DIRECTION_BY_KEY[code];

    if (direction) {
      event.preventDefault();
      var next = findInDirection(current, direction, candidates);
      if (next) focus(next);
      return;
    }

    if (code === KEY.TAB) {
      event.preventDefault();
      var index = candidates.indexOf(current);
      var step = event.shiftKey ? -1 : 1;
      var target = candidates[(index + step + candidates.length) % candidates.length];
      focus(target);
      return;
    }

    if (code === KEY.ENTER || code === KEY.SPACE) {
      event.preventDefault();
      activate(current);
    }
  }

  // A click (or a tap on a Magic Remote) moves the highlight to whatever was
  // clicked, so the two input methods never disagree about where the cursor is.
  function onClick(event) {
    var node = event.target;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute && node.hasAttribute('data-nav') && isVisible(node)) {
        focus(node, { scroll: false });
        return;
      }
      node = node.parentNode;
    }
  }

  function onWindowBlur() {
    // Coming back from the platform keyboard: re-assert the highlight so the
    // user is never left without a cursor.
    var scope = currentScope();
    if (!scope) return;
    var current = document.querySelector('.' + FOCUS_CLASS);
    if (!current || !isVisible(current)) focusFirst(scope.container, scope.lastFocused);
  }

  var initialised = false;

  function init(options) {
    if (initialised) return;
    initialised = true;

    var opts = options || {};
    backFallback = opts.onBack || null;

    var root = opts.container || document.getElementById('app') || document.body;
    pushScope(root, { onBack: opts.onBack || exitApp, initial: opts.initial });

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onClick, true);
    global.addEventListener('blur', onWindowBlur);
  }

  global.Nav = {
    KEYS: KEY,
    init: init,
    focus: focus,
    focused: function () { return document.querySelector('.' + FOCUS_CLASS); },
    refresh: refresh,
    pushScope: pushScope,
    popScope: popScope,
    currentScope: currentScope,
    scopeDepth: function () { return scopes.length; },
    activate: activate,
    exitApp: exitApp,
    setEnabled: function (value) { enabled = !!value; },
    isTextEntry: isTextEntry
  };

}(window));
