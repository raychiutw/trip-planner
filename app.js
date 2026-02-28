/* ===== Trip Data Loading ===== */
var TRIP = null;
var TRIP_FILE = localStorage.getItem('tripFile') || 'data/okinawa-trip-2026-Ray.json';

function loadTrip(filename) {
    TRIP_FILE = filename;
    localStorage.setItem('tripFile', filename);
    // Custom uploads stored in localStorage (prefix: custom:)
    if (filename.indexOf('custom:') === 0) {
        var raw = localStorage.getItem('tripData:' + filename);
        if (raw) {
            try { var data = JSON.parse(raw); TRIP = data; renderTrip(data); return; }
            catch(e) { /* fall through to error */ }
        }
        document.getElementById('tripContent').innerHTML = '<div style="text-align:center;padding:40px;color:#D32F2F;">❌ 自訂行程已過期，請重新上傳</div>';
        localStorage.removeItem('tripFile');
        return;
    }
    fetch(filename + '?t=' + Date.now())
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data) { TRIP = data; renderTrip(data); })
        .catch(function(e) {
            document.getElementById('tripContent').innerHTML = '<div style="text-align:center;padding:40px;color:#D32F2F;">❌ 載入失敗：' + filename + '<br>' + e.message + '</div>';
        });
}

function renderTrip(data) {
    // Update page title
    document.title = data.meta.title;

    // Build nav pills
    var navHtml = '';
    data.days.forEach(function(day) {
        navHtml += '<button class="dn" data-day="' + day.id + '" onclick="scrollToDay(' + day.id + ')">D' + day.id + '</button>';
    });
    document.getElementById('navPills').innerHTML = navHtml;

    // Build sections
    var html = '';

    // Day sections
    data.days.forEach(function(day) {
        html += '<section>';
        html += '<div class="day-header" id="day' + day.id + '"><h2>Day ' + day.id + '</h2><div class="dh-right">' + day.date + '</div></div>';
        html += '<div class="day-content">' + day.content + '</div>';
        html += '</section>';
    });

    // Info sections
    var infoSections = [
        { key: 'flights', id: 'sec-flight' },
        { key: 'checklist', id: 'sec-checklist' },
        { key: 'backup', id: 'sec-backup' },
        { key: 'emergency', id: 'sec-emergency' }
    ];
    infoSections.forEach(function(sec) {
        var d = data[sec.key];
        if (!d) return;
        html += '<section>';
        html += '<div class="day-header info-header" id="' + sec.id + '"><h2>' + d.title + '</h2><button class="dh-menu" onclick="toggleMenu(event)">≡</button></div>';
        html += '<div class="day-content">' + d.content + '</div>';
        html += '</section>';
    });

    // Footer
    html += '<footer>';
    html += '<h3>' + data.footer.title + '</h3>';
    html += '<p>' + data.footer.dates + '</p>';
    html += '<p style="font-weight:600;">' + data.footer.budget + '</p>';
    html += '<p style="color:var(--gray);">' + data.footer.exchangeNote + '</p>';
    html += '<p>' + data.footer.tagline + '</p>';
    html += '</footer>';

    document.getElementById('tripContent').innerHTML = html;

    // Build menu
    buildMenu(data);

    // Init ARIA
    initAria();

    // Init weather
    if (data.weather && data.weather.length) initWeather(data.weather);

    // Auto-scroll to today
    autoScrollToday(data.autoScrollDates);

    // Re-init nav scroll tracking
    initNavTracking();
}

function buildMenu(data) {
    var html = '<div class="menu-col">';
    data.days.forEach(function(day) {
        html += '<button class="menu-item" onclick="scrollToSec(\'day' + day.id + '\')">📍 D' + day.id + ' ' + day.label + '</button>';
    });
    html += '</div><div class="menu-col">';
    html += '<button class="menu-item" onclick="scrollToSec(\'sec-flight\')">✈️ 航班資訊</button>';
    html += '<button class="menu-item" onclick="scrollToSec(\'sec-checklist\')">✅ 出發前確認</button>';
    html += '<button class="menu-item" onclick="scrollToSec(\'sec-backup\')">🔄 颱風/雨天備案</button>';
    html += '<button class="menu-item" onclick="scrollToSec(\'sec-emergency\')">🆘 緊急聯絡</button>';
    html += '<div class="menu-sep"></div>';
    html += '<button class="menu-item" onclick="toggleDark()">🌙 深色模式</button>';
    html += '<button class="menu-item" onclick="togglePrint()">🖨️ 列印模式</button>';
    html += '<button class="menu-item" onclick="switchTripFile()">📂 切換行程檔</button>';
    html += '</div>';
    document.getElementById('menuGrid').innerHTML = html;
    // Update dark mode button text
    if (document.body.classList.contains('dark')) {
        var btn = document.querySelector('.menu-item[onclick*="toggleDark"]');
        if (btn) btn.textContent = '☀️ 淺色模式';
    }
}

/* ===== Toggle Functions ===== */
function toggleEv(e, el) {
    if (e.target.tagName === 'A') return;
    var ev = el.closest('.tl-event');
    ev.classList.toggle('expanded');
    el.setAttribute('aria-expanded', ev.classList.contains('expanded'));
}
function toggleCol(el) {
    el.classList.toggle('open');
    var detail = el.nextElementSibling;
    if (detail) detail.classList.toggle('open');
    el.setAttribute('aria-expanded', el.classList.contains('open'));
}
function toggleDark() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    document.body.classList.toggle('dark');
    var isDark = document.body.classList.contains('dark');
    localStorage.setItem('dark', isDark ? '1' : '0');
    var btn = document.querySelector('.menu-item[onclick*="toggleDark"]');
    if (btn) btn.textContent = isDark ? '☀️ 淺色模式' : '🌙 深色模式';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#1565C0' : '#0077B6');
}
if (localStorage.getItem('dark') === '1') {
    document.body.classList.add('dark');
    var dmeta = document.querySelector('meta[name="theme-color"]');
    if (dmeta) dmeta.setAttribute('content', '#1565C0');
}
function scrollToSec(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var navH = document.getElementById('stickyNav').offsetHeight;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH;
    window.scrollTo({ top: top, behavior: 'smooth' });
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
}
function scrollToDay(n) { scrollToSec('day' + n); }
function toggleMenu(e) {
    e.stopPropagation();
    var menu = document.getElementById('menuDrop');
    if (menu.classList.contains('open')) { menu.classList.remove('open'); document.body.style.overflow = ''; return; }
    var rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function toggleHw(el) {
    var p = el.closest('.hourly-weather');
    p.classList.toggle('hw-open');
    if (p.classList.contains('hw-open')) {
        var g = p.querySelector('.hw-grid');
        if (g) { var now = new Date().getHours(), tb = g.querySelector('.hw-now') || g.querySelector('[data-hour="' + Math.max(6, Math.min(21, now)) + '"]'); if (tb) g.scrollLeft = tb.offsetLeft - g.offsetLeft; }
    }
}
function togglePrint() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    var entering = !document.body.classList.contains('print-mode');
    if (entering && document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
        var btn = document.querySelector('.menu-item[onclick*="toggleDark"]');
        if (btn) btn.textContent = '🌙 深色模式';
    }
    document.body.classList.toggle('print-mode');
    if (!entering && document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
        var btn2 = document.querySelector('.menu-item[onclick*="toggleDark"]');
        if (btn2) btn2.textContent = '☀️ 淺色模式';
    }
}

/* ===== Switch Trip File ===== */
function switchTripFile() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    fetch('data/trips.json?t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(trips) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:400;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:var(--white);border-radius:12px;padding:20px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
            box.innerHTML = '<h3 style="margin:0 0 12px;font-size:1.1rem;color:var(--text);">📂 選擇行程</h3>';
            trips.forEach(function(t) {
                var btn = document.createElement('button');
                btn.className = 'menu-item';
                btn.style.cssText = 'width:100%;text-align:left;padding:12px;margin-bottom:4px;border-radius:8px;border:1.5px solid var(--blue-light);';
                btn.innerHTML = '<strong>' + t.name + '</strong><br><span style="font-size:0.85em;color:var(--gray);">' + t.dates + '</span>';
                if (TRIP_FILE === t.file) btn.style.borderColor = 'var(--blue)';
                btn.onclick = function() { document.body.removeChild(overlay); loadTrip(t.file); window.scrollTo({top:0,behavior:'smooth'}); };
                box.appendChild(btn);
            });
            // Show current custom trip if active
            if (TRIP_FILE.indexOf('custom:') === 0 && TRIP) {
                var customBtn = document.createElement('button');
                customBtn.className = 'menu-item';
                customBtn.style.cssText = 'width:100%;text-align:left;padding:12px;margin-bottom:4px;border-radius:8px;border:1.5px solid var(--blue);';
                customBtn.innerHTML = '<strong>📎 ' + TRIP_FILE.replace('custom:', '') + '</strong><br><span style="font-size:0.85em;color:var(--gray);">自訂上傳（localStorage）</span>';
                customBtn.onclick = function() { document.body.removeChild(overlay); };
                box.appendChild(customBtn);
            }
            // Upload custom
            var upBtn = document.createElement('button');
            upBtn.className = 'menu-item';
            upBtn.style.cssText = 'width:100%;text-align:center;padding:10px;margin-top:8px;color:var(--gray);';
            upBtn.textContent = '📁 上傳自訂 JSON 檔案';
            upBtn.onclick = function() {
                document.body.removeChild(overlay);
                var input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = function(e) {
                    var file = e.target.files[0]; if (!file) return;
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        try {
                            var data = JSON.parse(ev.target.result);
                            TRIP = data;
                            var key = 'custom:' + file.name;
                            TRIP_FILE = key;
                            localStorage.setItem('tripFile', key);
                            localStorage.setItem('tripData:' + key, ev.target.result);
                            renderTrip(data);
                            window.scrollTo({top:0,behavior:'smooth'});
                        }
                        catch(err) { alert('JSON 格式錯誤：' + err.message); }
                    };
                    reader.readAsText(file);
                };
                input.click();
            };
            box.appendChild(upBtn);
            // Close btn
            var closeBtn = document.createElement('button');
            closeBtn.className = 'menu-item';
            closeBtn.style.cssText = 'width:100%;text-align:center;padding:8px;margin-top:4px;color:var(--gray);';
            closeBtn.textContent = '✕ 關閉';
            closeBtn.onclick = function() { document.body.removeChild(overlay); };
            box.appendChild(closeBtn);
            overlay.appendChild(box);
            overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
            document.body.appendChild(overlay);
        })
        .catch(function() { alert('無法載入行程清單'); });
}

/* ===== ARIA Init ===== */
function initAria() {
    document.querySelectorAll('.col-row').forEach(function(el) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.tl-head.clickable').forEach(function(el) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
    });
}

/* ===== Day Nav Active Pill + Sticky Nav Update ===== */
function initNavTracking() {
    var headers = [];
    if (!TRIP) return;
    for (var i = 1; i <= TRIP.days.length; i++) { var h = document.getElementById('day' + i); if (h) headers.push(h); }
    var navPills = document.querySelectorAll('#stickyNav .dh-nav .dn[data-day]');
    if (!navPills.length) return;
    var navH = document.getElementById('stickyNav').offsetHeight;
    var infoStart = document.getElementById('sec-flight');
    // Remove old listener if any
    if (window._navScrollHandler) window.removeEventListener('scroll', window._navScrollHandler);
    var ticking = false;
    window._navScrollHandler = function() {
        if (!ticking) { requestAnimationFrame(function() {
            var inInfo = infoStart && infoStart.getBoundingClientRect().top <= navH + 10;
            var current = -1;
            if (!inInfo) { for (var i = 0; i < headers.length; i++) { if (headers[i].getBoundingClientRect().top <= navH + 10) current = i; } }
            navPills.forEach(function(btn) { btn.classList.toggle('active', current >= 0 && parseInt(btn.getAttribute('data-day')) === current + 1); });
            ticking = false;
        }); ticking = true; }
    };
    window.addEventListener('scroll', window._navScrollHandler);
    // Trigger once immediately to set initial state
    window._navScrollHandler();
}

/* ===== Auto-scroll to today ===== */
function autoScrollToday(dates) {
    if (!dates || !dates.length) return;
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    var idx = dates.indexOf(todayStr);
    if (idx >= 0) {
        var el = document.getElementById('day' + (idx + 1));
        if (el) {
            var navH = document.getElementById('stickyNav').offsetHeight;
            window.scrollTo({ top: el.offsetTop - navH, behavior: 'auto' });
        }
    }
}

// Close menu when clicking outside
document.addEventListener('click', function(e) {
    var menu = document.getElementById('menuDrop');
    if (menu && menu.classList.contains('open') && !e.target.closest('.dh-menu') && !e.target.closest('#menuDrop')) {
        menu.classList.remove('open'); document.body.style.overflow = '';
    }
});

/* ===== Hourly Weather API (Open-Meteo) ===== */
function initWeather(weatherDays) {
    var WMO={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',77:'🌨️',80:'🌦️',81:'🌧️',82:'🌧️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'};

    function getLocIdx(day,h){for(var i=day.locations.length-1;i>=0;i--)if(h>=day.locations[i].start)return i;return 0;}

    function renderHourly(c,m,day){
        var now=new Date(),ch=now.getHours();
        var minT=99,maxT=-99,minR=100,maxR=0,iconCount={},bestIcon='☀️';
        for(var h=0;h<24;h++){var t=Math.round(m.temps[h]),r=m.rains[h],ic=WMO[m.codes[h]]||'❓';if(t<minT)minT=t;if(t>maxT)maxT=t;if(r<minR)minR=r;if(r>maxR)maxR=r;iconCount[ic]=(iconCount[ic]||0)+1;}
        var maxCnt=0;for(var k in iconCount)if(iconCount[k]>maxCnt){maxCnt=iconCount[k];bestIcon=k;}
        var locs=day.locations.map(function(l){return l.name;}).filter(function(v,i,a){return a.indexOf(v)===i;}).join('→');
        var html='<div class="hw-summary" onclick="toggleHw(this)">'+bestIcon+' '+minT+'~'+maxT+'°C &nbsp;・&nbsp; 💧'+minR+'~'+maxR+'% &nbsp;・&nbsp; '+locs+'<span class="hw-summary-arrow">▸</span></div>';
        html+='<div class="hw-detail"><div class="hourly-weather-header"><span class="hourly-weather-title">⏱️ 逐時天氣 — '+day.label+'</span><span class="hw-update-time">'+ch+':'+String(now.getMinutes()).padStart(2,'0')+'</span></div><div class="hw-grid">';
        for(var h=0;h<=23;h++){
            var li=getLocIdx(day,h),icon=WMO[m.codes[h]]||'❓',temp=Math.round(m.temps[h]),rain=m.rains[h],isNow=(h===ch);
            html+='<div class="hw-block'+(isNow?' hw-now':'')+'" data-hour="'+h+'"><div class="hw-block-time">'+(isNow?'▶ ':'')+h+':00</div>';
            if(day.locations.length>1)html+='<div class="hw-block-loc hw-loc-'+li+'">'+day.locations[li].name+'</div>';
            html+='<div class="hw-block-icon">'+icon+'</div><div class="hw-block-temp">'+temp+'°C</div><div class="hw-block-rain'+(rain>=50?' hw-rain-high':'')+'">💧'+rain+'%</div></div>';
        }
        html+='</div></div>';c.innerHTML=html;
    }

    function fetchDay(day){
        var c=document.getElementById(day.id);if(!c)return;
        var uq=[],seen={};
        day.locations.forEach(function(l){var k=l.lat+','+l.lon;if(!seen[k]){seen[k]=true;uq.push(l);}});
        Promise.all(uq.map(function(l){
            return fetch('https://api.open-meteo.com/v1/forecast?latitude='+l.lat+'&longitude='+l.lon+'&hourly=temperature_2m,precipitation_probability,weather_code&start_date='+day.date+'&end_date='+day.date+'&timezone=Asia/Tokyo').then(function(r){return r.json();}).then(function(d){return{loc:l,data:d};});
        })).then(function(res){
            var dm={};res.forEach(function(r){dm[r.loc.lat+','+r.loc.lon]=r.data;});
            var mg={temps:[],rains:[],codes:[]};
            for(var h=0;h<24;h++){var li=getLocIdx(day,h),l=day.locations[li],d=dm[l.lat+','+l.lon];
                if(d&&d.hourly){mg.temps.push(d.hourly.temperature_2m[h]);mg.rains.push(d.hourly.precipitation_probability[h]);mg.codes.push(d.hourly.weather_code[h]);}
                else{mg.temps.push(0);mg.rains.push(0);mg.codes.push(0);}
            }
            renderHourly(c,mg,day);
        }).catch(function(e){c.innerHTML='<div class="hw-error">天氣資料載入失敗：'+e.message+'</div>';});
    }
    weatherDays.forEach(fetchDay);
}

window.addEventListener('beforeprint',function(){document.body.classList.add('print-mode');});
window.addEventListener('afterprint',function(){document.body.classList.remove('print-mode');});

// Initial load
loadTrip(TRIP_FILE);
