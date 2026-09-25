(function () {
  try {
    function readMode() {
      var raw = localStorage.getItem('tp-color-mode');
      if (raw) {
        try {
          var e = JSON.parse(raw);
          if (e && typeof e.exp === 'number' && Number.isFinite(e.exp) && e.exp > Date.now() &&
              (e.v === 'light' || e.v === 'dark' || e.v === 'auto')) {
            return e.v;
          }
        } catch (_) {}
      }
      var legacy = localStorage.getItem('tp-dark');
      if (legacy) {
        try {
          var le = JSON.parse(legacy);
          if (le && typeof le.exp === 'number' && Number.isFinite(le.exp) && le.exp > Date.now() && le.v === '1') return 'dark';
          if (le && typeof le.exp === 'number' && Number.isFinite(le.exp) && le.exp > Date.now() && le.v === '0') return 'light';
        } catch (_) {}
      }
      return 'auto';
    }
    var mode = 'auto';
    try { mode = readMode(); } catch (_) { /* Unavailable storage keeps the system default. */ }
    var dark = mode === 'dark' ||
      (mode === 'auto' && window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.setAttribute('data-tp-dark-init', '1');
      if (document.body) {
        document.body.classList.add('dark');
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('dark');
        });
      }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#1C1C1E');
    }
  } catch (_) {
    /* fail silently — useDarkMode hook 仍會 mount 後 catch up */
  }
})();
