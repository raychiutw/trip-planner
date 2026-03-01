/**
 * Global setup for testing app.js in jsdom environment.
 * Provides minimal stubs for browser APIs that app.js invokes on load.
 */

// jsdom provides window, document, localStorage, sessionStorage automatically.
// We just need to stub APIs that jsdom doesn't fully support.

// Stub fetch (app.js calls resolveAndLoad → loadTrip → fetch on load)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
}

// Load shared.js first and promote exports to global scope
// (In browser, <script> tags share global scope; in Node.js require() creates module scope)
var _shared = require('../js/shared.js');
Object.keys(_shared).forEach(function(k) { globalThis[k] = _shared[k]; });

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
const requiredIds = ['tripContent', 'navPills', 'stickyNav', 'menuDrop', 'menuGrid'];
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
