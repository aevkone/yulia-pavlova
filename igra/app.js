(() => {
  'use strict';
  const KEY = 'yulia-igra-v1';
  const $ = (s) => document.querySelector(s);
  const DECKS = window.DECKS;

  // Цвета колод — в гамме сайта
  const THEME_COLOR = {
    razo: '#E7E5E1', otn: '#D9714F', den: '#CFAE6B', real: '#8E9C82',
    sem: '#9E7A64', telo: '#D8A496', uver: '#A9472A'
  };
  const THEME_SHORT = { razo: 'Разогрев', otn: 'Отношения', den: 'Деньги', real: 'Работа', sem: 'Семья', telo: 'Тело', uver: 'Уверенность' };
  const ORDER = ['otn', 'den', 'real', 'sem', 'telo', 'uver', 'razo'];
  const TOKEN_COLORS = ['#F3F1EE', '#F0D59A', '#E9B89A', '#B9C7AE', '#BFB3D6', '#9FC1C9', '#E3A9A0', '#C9C3BA', '#F6E7C8', '#D4E2C6'];
  const ANSWERS = { no: 'Точно нет', mid: 'И да, и нет', yes: 'Точно да' };

  // Поле: 22 клетки по периметру сетки 6×7, по часовой от левого верхнего угла
  const CELLS = [];
  for (let c = 0; c < 6; c++) CELLS.push([0, c]);
  for (let r = 1; r < 7; r++) CELLS.push([r, 5]);
  for (let c = 4; c >= 0; c--) CELLS.push([6, c]);
  for (let r = 5; r >= 1; r--) CELLS.push([r, 0]);
  const N = CELLS.length;
  const themeOf = (i) => (i === 0 ? 'razo' : ORDER[(i * 3) % 7]);

  // ---------- Telegram ----------
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.platform && tg.platform !== 'unknown');
  if (inTg) {
    try {
      tg.ready(); tg.expand();
      tg.setHeaderColor && tg.setHeaderColor('#0B0B0A');
      tg.setBackgroundColor && tg.setBackgroundColor('#0B0B0A');
      tg.disableVerticalSwipes && tg.disableVerticalSwipes();
    } catch (e) { /* старые версии Telegram */ }
  }
  const haptic = (kind) => {
    try {
      if (!inTg || !tg.HapticFeedback) return;
      if (kind === 'select') tg.HapticFeedback.selectionChanged();
      else if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred(kind || 'light');
    } catch (e) {}
  };
  const confirmAsk = (text) => new Promise((res) => {
    if (inTg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) tg.showConfirm(text, res);
    else res(window.confirm(text));
  });

  // ---------- Состояние ----------
  let S = load() || fresh();
  function fresh() {
    return { players: [], pos: {}, turn: 0, decks: {}, history: [], pending: null, started: false, uid: 0 };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.players) ? s : null; }
    catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function draw(theme) {
    let d = S.decks[theme];
    if (!d || !d.length) {
      d = DECKS[theme].cards.map((_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    }
    const idx = d.pop();
    S.decks[theme] = d;
    return idx;
  }
  const current = () => S.players[S.turn % S.players.length];

  // ---------- Экраны ----------
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    window.scrollTo(0, 0);
  }

  // ---------- Участницы ----------
  const initial = (name) => (name.trim()[0] || '?').toUpperCase();
  function renderPlayers() {
    const ol = $('#players');
    ol.innerHTML = '';
    S.players.forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="num">${i + 1}</span><span class="token-i" style="background:${p.color}"></span><span class="name"></span><button class="rm" aria-label="Убрать">×</button>`;
      li.querySelector('.token-i').textContent = initial(p.name);
      li.querySelector('.name').textContent = p.name;
      li.querySelector('.rm').onclick = () => {
        S.players.splice(i, 1);
        delete S.pos[p.id];
        if (S.turn >= S.players.length) S.turn = 0;
        save(); renderPlayers();
      };
      ol.appendChild(li);
    });
    $('#btn-start').disabled = S.players.length < 1;
    $('#btn-start').textContent = S.started ? 'Вернуться к игре' : 'Начать игру';
  }
  $('#add-form').onsubmit = (e) => {
    e.preventDefault();
    const inp = $('#add-name');
    const name = inp.value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (S.players.length >= 10) { toast('Не больше 10 участниц'); return; }
    const used = new Set(S.players.map((p) => p.color));
    const color = TOKEN_COLORS.find((c) => !used.has(c)) || TOKEN_COLORS[S.players.length % TOKEN_COLORS.length];
    const id = 'p' + (++S.uid);
    S.players.push({ id, name, color });
    S.pos[id] = 0;
    inp.value = '';
    haptic('select');
    save(); renderPlayers();
    inp.focus();
  };
  $('#btn-start').onclick = () => {
    if (!S.players.length) return;
    S.started = true; save();
    openGame();
  };

  // ---------- Поле ----------
  const board = $('#board');
  const tokensLayer = document.createElement('div');
  tokensLayer.className = 'tokens';
  CELLS.forEach(([r, c], i) => {
    const el = document.createElement('div');
    const t = themeOf(i);
    el.className = 'cell' + (i === 0 ? ' start' : '');
    el.style.gridArea = `${r + 1}/${c + 1}`;
    el.style.background = THEME_COLOR[t];
    el.textContent = i === 0 ? 'Старт' : '';
    el.title = DECKS[t].title;
    el.dataset.i = i;
    board.appendChild(el);
  });
  board.appendChild(tokensLayer);
  const cellEl = (i) => board.querySelector(`.cell[data-i="${i}"]`);

  $('#legend').innerHTML = ORDER.map((t) => `<li><i style="background:${THEME_COLOR[t]}"></i>${THEME_SHORT[t]}</li>`).join('');

  function renderTokens() {
    tokensLayer.innerHTML = '';
    const byCell = {};
    S.players.forEach((p) => { const i = S.pos[p.id] || 0; (byCell[i] = byCell[i] || []).push(p); });
    const me = current();
    Object.entries(byCell).forEach(([i, ps]) => {
      const el = cellEl(i);
      const cx = el.offsetLeft + el.offsetWidth / 2, cy = el.offsetTop + el.offsetHeight / 2;
      ps.forEach((p, k) => {
        const n = ps.length;
        const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
        const rad = n > 1 ? Math.min(el.offsetWidth * 0.24, 6 + n * 2) : 0;
        const t = document.createElement('div');
        t.className = 'token' + (me && p.id === me.id ? ' me' : '');
        t.dataset.id = p.id;
        t.style.background = p.color;
        t.style.left = cx + Math.cos(ang) * rad + 'px';
        t.style.top = cy + Math.sin(ang) * rad + 'px';
        t.textContent = initial(p.name);
        tokensLayer.appendChild(t);
      });
    });
  }

  function renderQueue() {
    const q = $('#queue');
    q.innerHTML = '';
    const me = current();
    S.players.forEach((p) => {
      const b = document.createElement('span');
      b.className = 'q' + (me && p.id === me.id ? ' on' : '');
      b.innerHTML = `<span class="token-i" style="background:${p.color}"></span><span></span>`;
      b.firstChild.textContent = initial(p.name);
      b.lastChild.textContent = p.name;
      q.appendChild(b);
    });
    const on = q.querySelector('.on');
    on && on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function renderTurn() {
    const me = current();
    $('#turn-name').textContent = me ? me.name : '';
    $('#turn-label').textContent = 'Ходит';
    $('#dice-hint').textContent = 'Нажми на кубик';
    $('#dice-btn').classList.add('wait');
    renderQueue(); renderTokens();
  }

  function openGame() {
    show('s-game');
    renderTurn();
    if (S.pending) openCard(true);
  }

  // ---------- Кубик ----------
  const FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  let spin = 0, busy = false;
  const cube = $('#cube');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function roll() {
    if (busy || S.pending || !S.players.length) return;
    busy = true;
    const scene = $('#dice-btn');
    scene.classList.remove('wait'); scene.classList.add('busy');
    $('#dice-hint').textContent = '';
    haptic('medium');
    const v = 1 + Math.floor(Math.random() * 6);
    spin += 2;
    const [rx, ry] = FACE[v];
    cube.style.transform = `rotateX(-18deg) rotateY(18deg) rotateX(${rx + spin * 360}deg) rotateY(${ry + spin * 360}deg)`;
    await sleep(reduced ? 50 : 1150);
    haptic('light');
    $('#dice-hint').textContent = `Выпало ${v}`;

    const me = current();
    let p = S.pos[me.id] || 0;
    for (let s = 0; s < v; s++) {
      p = (p + 1) % N;
      S.pos[me.id] = p;
      renderTokens();
      haptic('select');
      await sleep(reduced ? 30 : 280);
    }
    const land = cellEl(p);
    land.classList.add('land');
    await sleep(reduced ? 30 : 450);
    land.classList.remove('land');

    const theme = themeOf(p);
    S.pending = { pid: me.id, theme, idx: draw(theme), answer: null, note: '' };
    save();
    scene.classList.remove('busy');
    busy = false;
    openCard(false);
  }
  $('#dice-btn').onclick = roll;
  $('#dice-btn').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); } };

  // ---------- Карточка ----------
  const flip = $('#card-flip');
  function fillCard() {
    const pd = S.pending;
    const me = S.players.find((x) => x.id === pd.pid);
    const chip = $('#card-theme');
    chip.textContent = DECKS[pd.theme].title;
    chip.style.background = THEME_COLOR[pd.theme];
    chip.style.color = pd.theme === 'uver' || pd.theme === 'sem' ? '#fff' : '#121211';
    if (pd.theme === 'razo') chip.style.boxShadow = 'inset 0 0 0 1px rgba(18,18,17,.18)'; else chip.style.boxShadow = '';
    $('#card-who').textContent = me ? me.name : '';
    $('#card-phrase').textContent = DECKS[pd.theme].cards[pd.idx];
    $('#card-note').value = pd.note || '';
    $('#scale').classList.toggle('optional', pd.theme === 'razo');
    for (const b of $('#scale').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === pd.answer));
    updateDone();
  }
  function updateDone() {
    const pd = S.pending;
    $('#btn-done').disabled = !(pd && (pd.answer || pd.theme === 'razo'));
  }
  async function openCard(instant) {
    fillCard();
    $('#card-layer').hidden = false;
    flip.classList.remove('open');
    // высота задника = высоте лицевой стороны
    if (instant || reduced) { flip.classList.add('open'); return; }
    await sleep(380);
    flip.classList.add('open');
    haptic('ok');
  }
  $('#scale').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || !S.pending) return;
    S.pending.answer = S.pending.answer === b.dataset.v && S.pending.theme === 'razo' ? null : b.dataset.v;
    haptic('select');
    save(); fillCard();
  };
  $('#card-note').oninput = (e) => { if (S.pending) { S.pending.note = e.target.value; save(); } };
  $('#btn-swap').onclick = () => {
    if (!S.pending) return;
    S.pending.idx = draw(S.pending.theme);
    S.pending.answer = null;
    save();
    flip.classList.remove('open');
    setTimeout(() => { fillCard(); flip.classList.add('open'); }, reduced ? 0 : 320);
  };
  $('#btn-done').onclick = () => {
    const pd = S.pending;
    if (!pd) return;
    const me = S.players.find((x) => x.id === pd.pid);
    S.history.push({
      pid: pd.pid, name: me ? me.name : '', theme: pd.theme,
      text: DECKS[pd.theme].cards[pd.idx], answer: pd.answer, note: (pd.note || '').trim(), t: Date.now()
    });
    S.pending = null;
    nextTurn();
    $('#card-layer').hidden = true;
    flip.classList.remove('open');
  };
  function nextTurn() {
    S.turn = (S.turn + 1) % S.players.length;
    save(); renderTurn();
    const me = current();
    if (S.players.length > 1) toast(`Передай телефон: ${me.name}`);
  }

  // ---------- Меню ----------
  $('#btn-menu').onclick = () => { $('#menu-layer').hidden = false; };
  $('#menu-layer').onclick = async (e) => {
    const act = e.target.closest('[data-act]');
    if (!act && e.target !== e.currentTarget) return;
    $('#menu-layer').hidden = true;
    const a = act ? act.dataset.act : 'close';
    if (a === 'summary') openSummary();
    else if (a === 'skip') { if (!busy) nextTurn(); }
    else if (a === 'players') { show('s-setup'); renderPlayers(); }
    else if (a === 'new') newGame();
  };

  async function newGame() {
    if (S.history.length && !(await confirmAsk('Начать новую игру? Итоги этой игры удалятся с телефона. Скопируй их заранее, если нужны.'))) return;
    const keepPlayers = S.players;
    S = fresh();
    S.uid = keepPlayers.length;
    S.players = keepPlayers;
    keepPlayers.forEach((p) => { S.pos[p.id] = 0; });
    save();
    $('#card-layer').hidden = true;
    show('s-setup'); renderPlayers();
  }

  // ---------- Итоги ----------
  function grouped() {
    return S.players.map((p) => ({ p, items: S.history.filter((h) => h.pid === p.id) }))
      .concat(orphanGroups());
  }
  function orphanGroups() {
    const ids = new Set(S.players.map((p) => p.id));
    const map = {};
    S.history.filter((h) => !ids.has(h.pid)).forEach((h) => { (map[h.pid] = map[h.pid] || { p: { name: h.name, color: '#6F6A63' }, items: [] }).items.push(h); });
    return Object.values(map);
  }
  function focusThemes(items) {
    const c = {};
    items.filter((h) => h.answer === 'yes' && h.theme !== 'razo').forEach((h) => { c[h.theme] = (c[h.theme] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t]) => DECKS[t].title);
  }
  function openSummary() {
    show('s-summary');
    const box = $('#summary');
    box.innerHTML = '';
    if (!S.history.length) { box.innerHTML = '<p class="empty">Пока ни одной карточки. Итоги появятся после первых ходов.</p>'; return; }
    grouped().forEach(({ p, items }) => {
      const d = document.createElement('div');
      d.className = 'person';
      d.innerHTML = `<div class="person-head"><span class="token-i" style="background:${p.color}"></span><span class="name"></span><span class="cnt">${items.length} карт.</span></div>`;
      d.querySelector('.token-i').textContent = initial(p.name);
      d.querySelector('.name').textContent = p.name;
      const f = focusThemes(items);
      if (f.length) {
        const fp = document.createElement('p'); fp.className = 'focus';
        fp.innerHTML = 'Сильнее отозвалось: <b></b>'; fp.querySelector('b').textContent = f.join(', ');
        d.appendChild(fp);
      }
      if (!items.length) { const e = document.createElement('p'); e.className = 'focus'; e.textContent = 'Ещё не ходила'; d.appendChild(e); }
      items.forEach((h) => {
        const e = document.createElement('div');
        e.className = 'entry';
        e.innerHTML = `<div class="entry-top"><i style="background:${THEME_COLOR[h.theme]}"></i><span></span>${h.answer ? `<span class="badge ${h.answer}">${ANSWERS[h.answer]}</span>` : ''}</div><p></p>`;
        e.querySelector('.entry-top span').textContent = DECKS[h.theme].title;
        e.querySelector('p').textContent = h.text;
        if (h.note) { const n = document.createElement('p'); n.className = 'note'; n.textContent = 'Заметка: ' + h.note; e.appendChild(n); }
        d.appendChild(e);
      });
      box.appendChild(d);
    });
  }
  function summaryText() {
    const date = new Date().toLocaleDateString('ru-RU');
    const lines = [`Итоги игры-знакомства, ${date}`, `Участниц: ${S.players.length}, карточек: ${S.history.length}`, ''];
    grouped().forEach(({ p, items }) => {
      if (!items.length) return;
      lines.push(`— ${p.name}`);
      const f = focusThemes(items);
      if (f.length) lines.push(`Сильнее отозвалось: ${f.join(', ')}`);
      items.forEach((h) => {
        lines.push(`• ${DECKS[h.theme].title}: «${h.text}»${h.answer ? ' — ' + ANSWERS[h.answer] : ''}`);
        if (h.note) lines.push(`  Заметка: ${h.note}`);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  $('#btn-copy').onclick = async () => {
    if (!S.history.length) { toast('Пока нечего копировать'); return; }
    const ok = await copy(summaryText());
    haptic(ok ? 'ok' : 'heavy');
    toast(ok ? 'Итоги скопированы' : 'Не получилось скопировать');
  };
  $('#btn-back').onclick = () => openGame();
  $('#btn-new').onclick = () => newGame();

  // ---------- Тост ----------
  let tt;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200);
  }

  window.addEventListener('resize', () => { if (!$('#s-game').hidden) renderTokens(); });

  // ---------- Старт ----------
  renderPlayers();
})();
