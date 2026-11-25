(() => {
  'use strict';
  // v2 · 14.11.2026: сохранение с версией и резервной копией, архив прошлых игр,
  // первый круг — разогрев, звук, отклик (фишка прыгает, поле вздрагивает), иконки тем,
  // кнопка «Назад» Telegram, безопасные зоны экрана.
  const KEY = 'yulia-igra-v1';            // имя ключа оставлено, чтобы не потерять уже начатые игры
  const BAK = KEY + '.bak';
  const ARCH = 'yulia-igra-archive';
  const SET = 'yulia-igra-settings';
  const VERSION = 2;
  const $ = (s) => document.querySelector(s);
  const DECKS = window.DECKS;

  // Цвета колод — в гамме сайта
  const THEME_COLOR = {
    razo: '#E7E5E1', otn: '#D9714F', den: '#CFAE6B', real: '#8E9C82',
    sem: '#9E7A64', telo: '#D8A496', uver: '#A9472A'
  };
  const DARK_THEME = { uver: 1, sem: 1 };
  const THEME_SHORT = { razo: 'Разогрев', otn: 'Отношения', den: 'Деньги', real: 'Работа', sem: 'Семья', telo: 'Тело', uver: 'Уверенность' };
  // Иконки — чтобы тему было видно не только по цвету
  const ICON = {
    otn: '<path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z"/>',
    den: '<circle cx="12" cy="12" r="7.5"/><path d="M10.3 16.5V8h2.9a2.3 2.3 0 0 1 0 4.6H8.8M8.8 14.6h4.4"/>',
    real: '<path d="M6.5 17.5l11-11M9.5 6.5h8v8"/>',
    sem: '<path d="M4.5 11.5L12 5.5l7.5 6M6.5 10v9h11v-9"/>',
    telo: '<path d="M12 20v-8.5M12 11.5C8.4 11.5 6.5 8.8 6.5 5.5c3.6 0 5.5 2.7 5.5 6zm0 0c3.6 0 5.5-2.7 5.5-6-3.6 0-5.5 2.7-5.5 6z"/>',
    uver: '<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/>',
    razo: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/>'
  };
  const icon = (t) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[t]}</svg>`;
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

  // ---------- Хранилище ----------
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };
  const settings = Object.assign({ sound: true }, parseJSON(ls.get(SET)) || {});
  const saveSettings = () => ls.set(SET, JSON.stringify(settings));
  function parseJSON(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  // ---------- Telegram ----------
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.platform && tg.platform !== 'unknown');
  const tgv = (v) => inTg && tg.isVersionAtLeast && tg.isVersionAtLeast(v);
  if (inTg) {
    try {
      tg.ready(); tg.expand();
      tg.setHeaderColor && tg.setHeaderColor('#0B0B0A');
      tg.setBackgroundColor && tg.setBackgroundColor('#0B0B0A');
      tgv('7.7') && tg.disableVerticalSwipes();
      tg.BackButton && tg.BackButton.onClick(() => goBack());
    } catch (e) { /* старые версии Telegram */ }
  }
  const haptic = (kind) => {
    try {
      if (!inTg || !tg.HapticFeedback || !tgv('6.1')) return;
      if (kind === 'select') tg.HapticFeedback.selectionChanged();
      else if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred(kind || 'light');
    } catch (e) {}
  };
  const confirmAsk = (text) => new Promise((res) => {
    if (tgv('6.2') && tg.showConfirm) tg.showConfirm(text, res);
    else res(window.confirm(text));
  });

  // ---------- Звук (синтез, без файлов) ----------
  const sfx = (() => {
    let ctx, out;
    const ok = () => {
      if (!settings.sound) return false;
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return true;
      } catch (e) { return false; }
    };
    const vary = (x, p = 0.08) => x * (1 + (Math.random() * 2 - 1) * p);
    function tone(freq, dur, { type = 'sine', vol = 0.18, at = 0, slide = 0 } = {}) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, { freq = 2000, q = 1, vol = 0.15, at = 0, sweep = 0 } = {}) {
      const t = ctx.currentTime + at, len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
      if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur);
    }
    return {
      roll() { if (!ok()) return; for (let i = 0; i < 9; i++) noise(0.035, { freq: vary(2600, 0.3), q: 4, vol: vary(0.22, 0.3), at: i * 0.09 + Math.random() * 0.03 }); },
      step() { if (!ok()) return; tone(vary(520, 0.06), 0.07, { type: 'triangle', vol: 0.12 }); },
      land() { if (!ok()) return; tone(196, 0.22, { type: 'sine', vol: 0.22, slide: 0.8 }); noise(0.05, { freq: 900, q: 2, vol: 0.12 }); },
      flip() { if (!ok()) return; noise(0.28, { freq: 600, q: 0.8, vol: 0.12, sweep: 4 }); },
      tap() { if (!ok()) return; tone(vary(880, 0.04), 0.05, { type: 'sine', vol: 0.08 }); },
      done() { if (!ok()) return; tone(659, 0.18, { vol: 0.1 }); tone(988, 0.3, { vol: 0.09, at: 0.09 }); }
    };
  })();

  // ---------- Состояние ----------
  function fresh() {
    return { v: VERSION, players: [], pos: {}, turn: 0, decks: {}, history: [], pending: null, started: false, uid: 0, warmup: true, startedAt: null };
  }
  // Миграции: каждая поднимает сохранение на одну версию. Не удалять старые.
  const MIGRATIONS = {
    1: (s) => { s.warmup = false; s.startedAt = null; s.v = 2; return s; }   // у старых игр разогрев не включаем
  };
  function valid(s) {
    return s && typeof s === 'object' && Array.isArray(s.players) && s.pos && typeof s.pos === 'object'
      && Array.isArray(s.history) && Number.isInteger(s.turn)
      && s.players.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      && (!s.pending || (DECKS[s.pending.theme] && DECKS[s.pending.theme].cards[s.pending.idx]));
  }
  function upgrade(s) {
    if (!s) return null;
    s.v = s.v || 1;
    if (s.v > VERSION) return null;                        // сохранение из более новой версии не трогаем
    while (s.v < VERSION) { const m = MIGRATIONS[s.v]; if (!m) return null; s = m(s); }
    return valid(s) ? s : null;
  }
  function load() {
    const main = upgrade(parseJSON(ls.get(KEY)));
    if (main) return main;
    const bak = upgrade(parseJSON(ls.get(BAK)));
    if (bak && ls.get(KEY)) setTimeout(() => toast('Игра восстановлена из резервной копии'), 600);
    return bak;
  }
  function save() {
    const prev = ls.get(KEY);
    if (prev) ls.set(BAK, prev);
    if (!ls.set(KEY, JSON.stringify(S))) toast('Память телефона переполнена — итоги не сохраняются');
  }
  let S = load() || fresh();

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
  const turnsOf = (pid) => S.history.filter((h) => h.pid === pid).length;
  const inWarmup = (p) => S.warmup && p && turnsOf(p.id) === 0;

  // ---------- Экраны (стек: карточка/меню поверх экрана) ----------
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    window.scrollTo(0, 0);
    syncBack();
  }
  const visible = (sel) => !$(sel).hidden;
  function syncBack() {
    if (!inTg || !tg.BackButton || !tgv('6.1')) return;
    const need = visible('#menu-layer') || visible('#s-summary') || (visible('#s-setup') && S.started && S.players.length);
    need ? tg.BackButton.show() : tg.BackButton.hide();
  }
  function goBack() {
    if (visible('#menu-layer')) { closeMenu(); return; }
    if (visible('#s-summary') || visible('#s-setup')) { if (S.started && S.players.length) openGame(); }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') goBack(); });

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
    $('#opt-warmup').checked = !!S.warmup;
    $('#opt-warmup-row').hidden = S.started;
    syncBack();
  }
  $('#opt-warmup').onchange = (e) => { S.warmup = e.target.checked; save(); };
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
    haptic('select'); sfx.tap();
    save(); renderPlayers();
    inp.focus();
  };
  $('#btn-start').onclick = () => {
    if (!S.players.length) return;
    if (!S.started) { S.started = true; S.startedAt = Date.now(); }
    save();
    sfx.tap();
    openGame();
  };

  // ---------- Поле ----------
  const board = $('#board');
  const tokensLayer = document.createElement('div');
  tokensLayer.className = 'tokens';
  CELLS.forEach(([r, c], i) => {
    const el = document.createElement('div');
    const t = themeOf(i);
    el.className = 'cell' + (i === 0 ? ' start' : '') + (DARK_THEME[t] ? ' dark' : '');
    el.style.gridArea = `${r + 1}/${c + 1}`;
    el.style.background = THEME_COLOR[t];
    el.innerHTML = i === 0 ? '<span>Старт</span>' : icon(t);
    el.title = DECKS[t].title;
    el.dataset.i = i;
    board.appendChild(el);
  });
  board.appendChild(tokensLayer);
  const cellEl = (i) => board.querySelector(`.cell[data-i="${i}"]`);

  $('#legend').innerHTML = ORDER.map((t) => `<li><i class="${DARK_THEME[t] ? 'dark' : ''}" style="background:${THEME_COLOR[t]}">${icon(t)}</i>${THEME_SHORT[t]}</li>`).join('');

  // Фишки живут постоянно, чтобы движение анимировалось, а не перерисовывалось
  const tokenEls = {};
  function renderTokens(hopId) {
    const byCell = {};
    S.players.forEach((p) => { const i = S.pos[p.id] || 0; (byCell[i] = byCell[i] || []).push(p); });
    const me = current();
    const alive = new Set();
    Object.entries(byCell).forEach(([i, ps]) => {
      const el = cellEl(i);
      const cx = el.offsetLeft + el.offsetWidth / 2, cy = el.offsetTop + el.offsetHeight / 2;
      ps.forEach((p, k) => {
        const n = ps.length;
        const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
        const rad = n > 1 ? Math.min(el.offsetWidth * 0.24, 6 + n * 2) : 0;
        let t = tokenEls[p.id];
        if (!t) {
          t = document.createElement('div');
          t.className = 'token'; t.innerHTML = '<b></b>';
          tokensLayer.appendChild(t); tokenEls[p.id] = t;
        }
        alive.add(p.id);
        t.style.background = p.color;
        t.firstChild.textContent = initial(p.name);
        t.classList.toggle('me', !!(me && p.id === me.id));
        t.style.left = cx + Math.cos(ang) * rad + 'px';
        t.style.top = cy + Math.sin(ang) * rad + 'px';
        if (hopId === p.id && !reduced) { t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); }
      });
    });
    Object.keys(tokenEls).forEach((id) => { if (!alive.has(id)) { tokenEls[id].remove(); delete tokenEls[id]; } });
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
    $('#turn-label').textContent = inWarmup(me) ? 'Разогрев · ходит' : 'Ходит';
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
  function bump(el, cls) {
    if (reduced) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 500);
  }

  async function roll() {
    if (busy || S.pending || !S.players.length) return;
    busy = true;
    const scene = $('#dice-btn');
    scene.classList.remove('wait'); scene.classList.add('busy');
    $('#dice-hint').textContent = '';
    // замах перед броском
    bump(scene, 'windup');
    await sleep(reduced ? 0 : 110);
    haptic('medium'); sfx.roll();
    const v = 1 + Math.floor(Math.random() * 6);
    spin += 2;
    const [rx, ry] = FACE[v];
    cube.style.transform = `rotateX(-18deg) rotateY(18deg) rotateX(${rx + spin * 360}deg) rotateY(${ry + spin * 360}deg)`;
    await sleep(reduced ? 50 : 1150);
    haptic('light');
    bump($('#board'), 'thud');                 // поле чуть вздрагивает, когда кубик лёг
    $('#dice-hint').textContent = `Выпало ${v}`;

    const me = current();
    const warm = inWarmup(me);
    let p = S.pos[me.id] || 0;
    for (let s = 0; s < v; s++) {
      p = (p + 1) % N;
      S.pos[me.id] = p;
      renderTokens(me.id);
      haptic('select'); sfx.step();
      await sleep(reduced ? 30 : 300);
    }
    const land = cellEl(p);
    land.classList.add('land');
    sfx.land(); haptic('medium');
    await sleep(reduced ? 30 : 450);
    land.classList.remove('land');

    const theme = warm ? 'razo' : themeOf(p);
    S.pending = { pid: me.id, theme, idx: draw(theme), answer: null, note: '', warm };
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
    chip.innerHTML = icon(pd.theme) + '<span></span>';
    chip.lastChild.textContent = pd.warm ? 'Первый круг · Разогрев' : DECKS[pd.theme].title;
    chip.style.background = THEME_COLOR[pd.theme];
    chip.style.color = DARK_THEME[pd.theme] ? '#fff' : '#121211';
    chip.style.boxShadow = pd.theme === 'razo' ? 'inset 0 0 0 1px rgba(18,18,17,.18)' : '';
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
    if (instant || reduced) { flip.classList.add('open'); focusCard(); return; }
    await sleep(380);
    flip.classList.add('open');
    sfx.flip(); haptic('ok');
    setTimeout(focusCard, 450);
  }
  // фокус внутри карточки (для клавиатуры и экранных читалок), не открывая клавиатуру телефона
  let kbd = false;
  document.addEventListener('keydown', () => { kbd = true; }, true);
  document.addEventListener('pointerdown', () => { kbd = false; }, true);
  function focusCard() { if (!kbd) return; const b = $('#scale button'); b && b.focus({ preventScroll: true }); }
  $('#scale').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || !S.pending) return;
    S.pending.answer = S.pending.answer === b.dataset.v && S.pending.theme === 'razo' ? null : b.dataset.v;
    haptic('select'); sfx.tap();
    save(); fillCard();
    bump(b, 'pop');
  };
  $('#card-note').oninput = (e) => { if (S.pending) { S.pending.note = e.target.value; save(); } };
  $('#btn-swap').onclick = () => {
    if (!S.pending) return;
    S.pending.idx = draw(S.pending.theme);
    S.pending.answer = null;
    save();
    flip.classList.remove('open');
    setTimeout(() => { fillCard(); flip.classList.add('open'); sfx.flip(); }, reduced ? 0 : 320);
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
    sfx.done();
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
  function openMenu() {
    $('#menu-sound').textContent = settings.sound ? 'Звук: включён' : 'Звук: выключен';
    $('#menu-layer').hidden = false; syncBack();
    if (kbd) $('#menu-layer .sheet-item').focus({ preventScroll: true });
  }
  function closeMenu() { $('#menu-layer').hidden = true; syncBack(); }
  $('#btn-menu').onclick = openMenu;
  $('#menu-layer').onclick = async (e) => {
    const act = e.target.closest('[data-act]');
    if (!act && e.target !== e.currentTarget) return;
    const a = act ? act.dataset.act : 'close';
    if (a === 'sound') {
      settings.sound = !settings.sound; saveSettings(); sfx.tap();
      $('#menu-sound').textContent = settings.sound ? 'Звук: включён' : 'Звук: выключен';
      return;
    }
    closeMenu();
    if (a === 'summary') openSummary();
    else if (a === 'skip') { if (!busy) nextTurn(); }
    else if (a === 'players') { show('s-setup'); renderPlayers(); }
    else if (a === 'new') newGame();
  };

  // Завершённую игру не стираем, а кладём в архив (последние 10)
  function archive() {
    if (!S.history.length) return;
    const list = parseJSON(ls.get(ARCH)) || [];
    list.unshift({ at: Date.now(), startedAt: S.startedAt, players: S.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), history: S.history });
    ls.set(ARCH, JSON.stringify(list.slice(0, 10)));
  }
  async function newGame() {
    if (S.history.length && !(await confirmAsk('Начать новую игру? Итоги этой игры останутся в «Прошлых играх» на странице итогов.'))) return;
    archive();
    const keepPlayers = S.players, warm = S.warmup;
    S = fresh();
    S.uid = keepPlayers.reduce((m, p) => Math.max(m, +p.id.slice(1) || 0), 0);
    S.players = keepPlayers; S.warmup = warm;
    keepPlayers.forEach((p) => { S.pos[p.id] = 0; });
    save();
    $('#card-layer').hidden = true;
    show('s-setup'); renderPlayers();
  }

  // ---------- Итоги ----------
  function grouped(players, history) {
    const ids = new Set(players.map((p) => p.id));
    const out = players.map((p) => ({ p, items: history.filter((h) => h.pid === p.id) }));
    const map = {};
    history.filter((h) => !ids.has(h.pid)).forEach((h) => { (map[h.pid] = map[h.pid] || { p: { name: h.name, color: '#6F6A63' }, items: [] }).items.push(h); });
    return out.concat(Object.values(map));
  }
  function focusThemes(items) {
    const c = {};
    items.filter((h) => h.answer === 'yes' && h.theme !== 'razo').forEach((h) => { c[h.theme] = (c[h.theme] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t]) => DECKS[t].title);
  }
  function personCard(p, items) {
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
    return d;
  }
  const fmtDate = (ts) => new Date(ts || Date.now()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  function openSummary() {
    show('s-summary');
    const box = $('#summary');
    box.innerHTML = '';
    if (!S.history.length) {
      const e = document.createElement('p'); e.className = 'empty';
      e.textContent = 'Пока ни одной карточки. Итоги появятся после первых ходов.'; box.appendChild(e);
    } else {
      grouped(S.players, S.history).forEach(({ p, items }) => box.appendChild(personCard(p, items)));
    }
    const list = parseJSON(ls.get(ARCH)) || [];
    if (list.length) {
      const h = document.createElement('p'); h.className = 'label arch-label'; h.textContent = 'Прошлые игры';
      box.appendChild(h);
      list.forEach((g) => {
        const row = document.createElement('div'); row.className = 'arch';
        row.innerHTML = `<div><b></b><span></span></div><button class="pill ghost small">Скопировать</button>`;
        row.querySelector('b').textContent = fmtDate(g.startedAt || g.at);
        row.querySelector('span').textContent = `${g.players.map((p) => p.name).join(', ')} · ${g.history.length} карт.`;
        row.querySelector('button').onclick = () => copyText(summaryText(g.players, g.history, g.startedAt || g.at));
        box.appendChild(row);
      });
    }
  }
  function summaryText(players, history, ts) {
    const lines = [`Итоги игры-знакомства, ${fmtDate(ts)}`, `Участниц: ${players.length}, карточек: ${history.length}`, ''];
    grouped(players, history).forEach(({ p, items }) => {
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
  async function copyText(text) {
    const ok = await copy(text);
    haptic(ok ? 'ok' : 'heavy'); ok && sfx.done();
    toast(ok ? 'Итоги скопированы' : 'Не получилось скопировать');
  }
  $('#btn-copy').onclick = () => {
    if (!S.history.length) { toast('Пока нечего копировать'); return; }
    copyText(summaryText(S.players, S.history, S.startedAt));
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
