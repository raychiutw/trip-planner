    const params = new URLSearchParams(location.search);
    const variants = ['a', 'b', 'c'];
    const states = ['away', 'refreshing', 'refresh-error', 'history-loading', 'history-error'];
    let variant = variants.includes(params.get('variant')) ? params.get('variant') : 'a';
    let state = states.includes(params.get('state')) ? params.get('state') : 'away';
    const descriptions = {
      away: '離開最新端時，44 × 44 圓形箭頭固定在聊天欄中央、輸入框上方 12px。',
      refreshing: '回到底部後，原位置以 spinner 呈現最新訊息刷新；既有訊息保留。',
      'refresh-error': '最新刷新失敗時原位置提供可鍵盤操作的重試控制項。',
      'history-loading': '往上讀舊訊息時，頂部 sticky 狀態不推動訊息位置。',
      'history-error': '舊訊息讀取失敗在頂部原位置提供重試，與最新刷新錯誤分離。',
    };
    function render() {
      document.getElementById('frame').dataset.variant = variant;
      document.getElementById('frame').dataset.state = state;
      document.getElementById('explain').textContent = descriptions[state];
      for (const button of document.querySelectorAll('[data-pick-variant]')) button.setAttribute('aria-pressed', String(button.dataset.pickVariant === variant));
      for (const button of document.querySelectorAll('[data-pick-state]')) button.setAttribute('aria-pressed', String(button.dataset.pickState === state));
      const historyEl = document.getElementById('history');
      historyEl.innerHTML = state === 'history-loading' ? '<span class="spin" aria-hidden="true"></span>載入較早訊息…' : '無法載入較早訊息 <button type="button" id="retry-history">重試</button>';
      const latest = document.getElementById('latest');
      latest.classList.toggle('retry', state === 'refresh-error');
      latest.innerHTML = state === 'refreshing' ? '<span class="spin" aria-hidden="true"></span>' : state === 'refresh-error' ? '更新失敗 · 重試' : '↓';
      latest.setAttribute('aria-label', state === 'refreshing' ? '正在更新最新訊息' : state === 'refresh-error' ? '重新更新最新訊息' : '回到最新訊息');
      latest.style.display = state.startsWith('history') ? 'none' : 'grid';
      historyEl.style.display = state.startsWith('history') ? 'flex' : 'none';
      document.getElementById('retry-history')?.addEventListener('click', () => { state = 'history-loading'; render(); });
      const next = new URL(location.href); next.searchParams.set('variant', variant); next.searchParams.set('state', state); window.history.replaceState(null, '', next);
    }
    for (const button of document.querySelectorAll('[data-pick-variant]')) button.addEventListener('click', () => { variant = button.dataset.pickVariant; render(); });
    for (const button of document.querySelectorAll('[data-pick-state]')) button.addEventListener('click', () => { state = button.dataset.pickState; render(); });
    document.getElementById('latest').addEventListener('click', () => { state = 'refreshing'; render(); });
    render();
