/**
 * Global setup for testing app.js in jsdom environment.
 * Provides minimal stubs for browser APIs that app.js invokes on load.
 */

// jsdom provides window, document, localStorage, sessionStorage automatically.
// We just need to stub APIs that jsdom doesn't fully support.

// Node.js v22+ has a built-in localStorage that lacks getItem/setItem.
// Provide a full in-memory implementation to avoid conflicts.
(function() {
  var store = {};
  globalThis.localStorage = {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function(k, v) { store[k] = String(v); },
    removeItem: function(k) { delete store[k]; },
    clear: function() { store = {}; },
    get length() { return Object.keys(store).length; },
    key: function(i) { return Object.keys(store)[i] || null; }
  };
})();

// Stub fetch (app.js calls resolveAndLoad → loadTrip → fetch on load)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
}

// Load shared.js first and promote exports to global scope
// (In browser, <script> tags share global scope; in Node.js require() creates module scope)
var _shared = require('../js/shared.js');
Object.keys(_shared).forEach(function(k) { globalThis[k] = _shared[k]; });

// Load menu.js and promote exports to global scope (app.js depends on menu.js functions)
var _menu = require('../js/menu.js');
Object.keys(_menu).forEach(function(k) { globalThis[k] = _menu[k]; });

// Load icons.js and promote exports to global scope (app.js depends on icons.js functions)
var _icons = require('../js/icons.js');
Object.keys(_icons).forEach(function(k) { globalThis[k] = _icons[k]; });

// Stub DOMParser if not available (used by sanitizeHtml)
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class {
    parseFromString(html, type) {
      const doc = document.implementation.createHTMLDocument('');
      doc.body.innerHTML = html;
      return doc;
    }
  };
}

// Stub requestAnimationFrame (used by initNavTracking)
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

// Ensure document has required elements (app.js queries these on load)
const requiredIds = ['tripContent', 'navPills', 'stickyNav', 'menuDrop', 'menuGrid', 'sidebar', 'menuBackdrop'];
requiredIds.forEach((id) => {
  if (!document.getElementById(id)) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
});

// Stub meta tags queried by renderTrip
['description', 'theme-color'].forEach((name) => {
  if (!document.querySelector(`meta[name="${name}"]`)) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
});
['og:title', 'og:description'].forEach((prop) => {
  if (!document.querySelector(`meta[property="${prop}"]`)) {
    const meta = document.createElement('meta');
    meta.setAttribute('property', prop);
    document.head.appendChild(meta);
  }
});
