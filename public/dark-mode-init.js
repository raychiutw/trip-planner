(function () {
  try {
    function readMode() {
      var raw = localStorage.getItem('tp-color-mode');
      if (raw) {
        try {
          var e = JSON.parse(raw);
          if (e && (!e.exp || e.exp > Date.now()) &&
              (e.v === 'light' || e.v === 'dark' || e.v === 'auto')) {
            return e.v;
          }
        } catch (_) {}
      }
      var legacy = localStorage.getItem('tp-dark');
      if (legacy) {
        try {
          var le = JSON.parse(legacy);
          if (le && le.v === '1') return 'dark';
          if (le && le.v === '0') return 'light';
        } catch (_) {}
      }
      return 'auto';
    }
    // App 開啟 web 時帶 ?theme=light|dark：套用並持久化；其他值（含大小寫不符）一律忽略
    var mode = readMode();
    var ts = new URLSearchParams(location.search).getAll('theme');
    var t = ts.length === 1 ? ts[0] : null; // 與 api 一致：重複視為沒帶
    if (t === 'light' || t === 'dark') {
      mode = t;
      try {
        // 格式須與 src/lib/localStorage.ts 的 lsSet 一致（6 個月 TTL）
        localStorage.setItem('tp-color-mode', JSON.stringify({ v: t, exp: Date.now() + 180 * 86400000 }));
      } catch (_) {}
    }
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
