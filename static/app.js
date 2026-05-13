// ── State ──
let topic      = null;
let mode       = 'learn';
let messages   = [];
let streaming  = false;
let curriculum = [];
let topics     = {};

// ── Выбор модели ──
function savePreferredModel(val) {
  localStorage.setItem('mlops_model', val);
}
function getPreferredModel() {
  return localStorage.getItem('mlops_model') || 'llama-3.3-70b-versatile';
}
(function initModelSelect() {
  const sel = document.getElementById('model-select');
  if (sel) sel.value = getPreferredModel();
})();
let progress   = new Set(JSON.parse(localStorage.getItem('mlops_progress') || '[]'));

// ── Session (per browser tab via sessionStorage) ──
function saveSession() {
  sessionStorage.setItem('mlops_session', JSON.stringify({ topic, mode }));
}
function restoreSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem('mlops_session'));
    if (!s || !s.topic || !topics[s.topic]) return;
    mode = s.mode || 'learn';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`)?.classList.add('active');
    const cfg = MODES[mode];
    const badge = document.getElementById('mode-badge');
    badge.textContent = cfg.label;
    badge.className   = `mode-badge ${cfg.badge}`;
    const isStatic = mode === 'cheatsheet' || mode === 'mcquiz';
    document.getElementById("messages").style.display    = isStatic ? "none" : "";
    document.getElementById('input-row')?.style && (document.getElementById('input-row').style.display = isStatic ? 'none' : '');
    document.getElementById('quick-area').style.display  = isStatic ? 'none' : '';
    document.getElementById('cheatsheet-view').style.display = mode === 'cheatsheet' ? 'flex' : 'none';
    document.getElementById('mcquiz-view').style.display     = mode === 'mcquiz'     ? 'flex' : 'none';
    renderQuickActions();
    selectTopic(s.topic);
  } catch (_) {}
}

// ── Depth indicator ──
const DEPTH_MODES = ['learn', 'quiz', 'mock'];
const DEPTH_LABELS = { learn: 'Объяснение', quiz: 'Квиз', mock: 'Mock' };

function getDepth(tid, m) {
  try {
    const saved = JSON.parse(localStorage.getItem(histKey(tid, m)));
    return saved ? Math.floor(saved.length / 2) : 0; // пар сообщений
  } catch { return 0; }
}

function depthColor(count) {
  if (count === 0) return 'var(--text-dimmer)';
  if (count < 4)  return '#f59e0b';   // жёлтый — начал
  if (count < 10) return '#f97316';   // оранжевый — в процессе
  return '#22c55e';                   // зелёный — проработал
}

function depthDots(tid) {
  return DEPTH_MODES.map(m => {
    const count = getDepth(tid, m);
    const color = depthColor(count);
    const label = `${DEPTH_LABELS[m]}: ${count} обменов`;
    return `<span class="depth-dot" style="background:${color}" title="${label}"></span>`;
  }).join('');
}

// ── History persistence ──
function histKey(tid, m) { return `mlops_chat_${tid}_${m}`; }
function saveHistory(tid, m, msgs) {
  localStorage.setItem(histKey(tid, m), JSON.stringify(msgs));
}
function loadHistory(tid, m) {
  try { return JSON.parse(localStorage.getItem(histKey(tid, m))) || null; }
  catch { return null; }
}
function clearHistory(tid, m) {
  localStorage.removeItem(histKey(tid, m));
}

// Отрисовать все сообщения из массива messages
function renderAllMessages() {
  clearMessages();
  // Первые два — внутренний trigger + первый ответ AI, показываем только с 3-го если trigger скрытый
  // Но проще показать все: trigger (user) тоже видимый смысл имеет только если не авто-стартовый
  // Пропускаем первое сообщение если оно — авто-триггер (роль user, начинается с "Начнём тему")
  const skipFirst = messages.length > 0 && messages[0].role === 'user' &&
    (messages[0].content.startsWith('Начнём') || messages[0].content.startsWith('Объясни тему'));
  const start = skipFirst ? 1 : 0;
  for (let i = start; i < messages.length; i++) {
    const m = messages[i];
    appendBubble(m.role === 'user' ? 'user' : 'ai', m.content);
  }
}

// ── Theme ──
// Тема всегда следует системной (prefers-color-scheme), без сохранения выбора.
function systemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}
function initTheme() {
  // Подчищаем старое значение, оставшееся у пользователей с прошлой кнопкой переключения.
  localStorage.removeItem('mlops_theme');
  applyTheme(systemTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (e) => {
      applyTheme(e.matches ? 'light' : 'dark');
    });
  }
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('hljs-css').href =
    t === 'dark'
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
}

// ── Modes ──
const MODES = {
  learn:      { label: 'Объяснение',    badge: 'badge-learn' },
  quiz:       { label: 'Квиз',          badge: 'badge-quiz'  },
  mock:       { label: 'Mock Interview', badge: 'badge-mock' },
  cheatsheet: { label: 'Чит-шит',       badge: 'badge-cheatsheet' },
  mcquiz:     { label: 'Тест',          badge: 'badge-mcquiz' },
};
const QUICK = {
  learn: [
    { label: '🔄 Объясни иначе',       msg: 'Объясни иначе — другими словами или аналогией.' },
    { label: '💻 Пример кода',          msg: 'Покажи конкретный пример кода или конфига.' },
    { label: '🎯 Главное для интервью', msg: 'Что самое важное запомнить для собеседования? Кратко.' },
    { label: '🧠 Перейти к квизу',      action: () => setMode('quiz') },
    { label: '🗑️ Сначала',              action: () => restartTopic() },
  ],
  quiz: [
    { label: '💡 Подсказку',            msg: 'Дай минимальную подсказку, не раскрывая ответ.' },
    { label: '✅ Правильный ответ',     msg: 'Объясни правильный ответ.' },
    { label: '➡️ Следующий вопрос',     msg: 'Следующий вопрос.' },
    { label: '📖 К объяснению',         action: () => setMode('learn') },
    { label: '🗑️ Сначала',              action: () => restartTopic() },
  ],
  mock: [
    { label: '💡 Намекни',              msg: 'Я застрял — дай подсказку без прямого ответа.' },
    { label: '⏸️ Фидбек',               msg: 'Дай фидбек по моим ответам пока что.' },
    { label: '➡️ Следующий вопрос',     msg: 'Следующий вопрос.' },
    { label: '🗑️ Сначала',              action: () => restartTopic() },
  ],
};

// ── Init ──
async function init() {
  initTheme();
  const res  = await fetch('/api/curriculum');
  const data = await res.json();
  curriculum = data.curriculum;
  topics     = data.topics;
  renderSidebar();
  if (await tryLoadFromShare()) return;
  restoreSession();
}

// Гидрация стейта из shared-ссылки. Возвращает true, если применили.
async function tryLoadFromShare() {
  const params = new URLSearchParams(location.search);
  if (!params.get('s')) return false;
  try {
    const state = await window.shareApi.loadShare();
    if (!state || !state.topic_id || !topics[state.topic_id]) {
      toast('Ссылка повреждена');
      history.replaceState(null, '', '/');
      return false;
    }
    topic    = state.topic_id;
    mode     = state.mode || 'learn';
    messages = Array.isArray(state.messages) ? state.messages : [];

    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`)?.classList.add('active');
    const cfg = MODES[mode];
    if (cfg) {
      const badge = document.getElementById('mode-badge');
      badge.textContent = cfg.label;
      badge.className   = `mode-badge ${cfg.badge}`;
    }
    document.getElementById('header-topic').textContent = topics[topic].title;

    renderSidebar();
    renderQuickActions();
    renderAllMessages();

    saveHistory(topic, mode, messages);
    saveSession();
    history.replaceState(null, '', '/');
    toast('Сессия загружена');
    return true;
  } catch (e) {
    const msg = e && e.message === 'expired'
      ? 'Ссылка истекла'
      : 'Не получилось открыть ссылку';
    toast(msg);
    history.replaceState(null, '', '/');
    return false;
  }
}

// ── Sidebar ──
function renderSidebar() {
  const el = document.getElementById('curriculum-tree');
  // count groups per section to decide whether to show group labels
  const sectionCounts = {};
  for (const g of curriculum) {
    const s = g.section || '';
    sectionCounts[s] = (sectionCounts[s] || 0) + 1;
  }
  let html = '';
  let currentSection = null;
  for (const group of curriculum) {
    const section = group.section || '';
    if (section !== currentSection) {
      if (currentSection !== null) html += `<div class="week-divider"></div>`;
      html += `<div class="section-header">${section}</div>`;
      currentSection = section;
    }
    if (sectionCounts[section] > 1) {
      html += `<div class="group-label">${group.title}</div>`;
    }
    for (const tid of group.topics) {
      const t = topics[tid];
      if (!t) continue;
      const done   = progress.has(tid);
      const active = topic === tid;
      const icon   = done ? '✓' : t.emoji;
      html += `<button class="topic-btn${done?' done':''}${active?' active':''}"
                       onclick="selectTopic('${tid}')">
                 <span class="t-icon">${icon}</span>
                 <span class="t-title">${t.title}</span>
                 <span class="topic-depth">${depthDots(tid)}</span>
               </button>`;
    }
  }
  el.innerHTML = html;
}

// ── Select topic ──
function selectTopic(tid) {
  topic    = tid;
  messages = [];
  clearMessages();
  renderSidebar();
  closeSidebar();
  document.getElementById('header-topic').textContent = topics[tid].title;
  renderQuickActions();

  saveSession();

  if (mode === 'cheatsheet') { renderCheatsheet(tid); return; }
  if (mode === 'mcquiz')     { renderMCQuiz(tid);     return; }

  const saved = loadHistory(tid, mode);
  if (saved && saved.length >= 2) {
    messages = saved;
    renderAllMessages();
    renderQuickActions();
  } else {
    const t = topics[tid];
    const openers = {
      learn: `Начнём тему "${t.title}". Объясни с нуля — я знаю Python и веб, но эту область не трогал.`,
      quiz:  `Начнём квиз по теме "${t.title}". Задавай вопросы как на интервью.`,
      mock:  'Начнём mock-интервью. Я готов.',
    };
    autoStart(openers[mode]);
  }
}

// ── Restart (очистить историю и начать заново) ──
function restartTopic() {
  if (!topic) return;
  clearHistory(topic, mode);
  messages = [];
  clearMessages();
  const t = topics[topic];
  const openers = {
    learn: `Начнём тему "${t.title}" заново. Объясни с нуля.`,
    quiz:  `Начнём квиз по теме "${t.title}" заново.`,
    mock:  'Начнём mock-интервью заново. Я готов.',
  };
  autoStart(openers[mode]);
}

// ── Auto-start ──
async function autoStart(triggerMsg) {
  streaming = true;
  setSend(false);
  const bubble     = appendBubble('ai', null);
  const triggerEntry = { role: 'user', content: triggerMsg };
  try {
    const res    = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [triggerEntry], topic_id: topic, mode, model: getPreferredModel() }),
    });
    const aiText = await streamInto(res, bubble);
    messages.push(triggerEntry);
    messages.push({ role: 'assistant', content: aiText });
    saveHistory(topic, mode, messages);
    renderSidebar();
    renderQuickActions();
  } catch (e) {
    bubble.innerHTML = `<em style="color:#ef4444">Ошибка: ${e.message}</em>`;
  }
  streaming = false;
  setSend(true);
}

// ── Mode switch ──
function setMode(m) {
  mode = m;
  const isStatic = m === 'cheatsheet' || m === 'mcquiz';
  const chatMessages   = document.getElementById('messages');
  const inputRow       = document.getElementById('input-row');
  const quickArea      = document.getElementById('quick-area');
  const cheatsheetView = document.getElementById('cheatsheet-view');
  const mcquizView     = document.getElementById('mcquiz-view');
  if (chatMessages)   chatMessages.style.display   = isStatic ? 'none' : '';
  if (inputRow)       inputRow.style.display       = isStatic ? 'none' : '';
  if (quickArea)      quickArea.style.display      = isStatic ? 'none' : '';
  if (cheatsheetView) cheatsheetView.style.display = m === 'cheatsheet' ? 'flex' : 'none';
  if (mcquizView)     mcquizView.style.display     = m === 'mcquiz'     ? 'flex' : 'none';
  if (cheatsheetView) cheatsheetView.style.flexDirection = 'column';
  if (mcquizView)     mcquizView.style.flexDirection     = 'column';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('mode-' + m);
  if (btn) btn.classList.add('active');
  const cfg   = MODES[m];
  const badge = document.getElementById('mode-badge');
  if (cfg) {
    badge.textContent = cfg.label;
    badge.className   = `mode-badge ${cfg.badge}`;
  }
  renderQuickActions();
  saveSession();
  if (m === 'cheatsheet' && topic) { renderCheatsheet(topic); return; }
  if (m === 'mcquiz'     && topic) { renderMCQuiz(topic);     return; }
  if (!isStatic && topic) {
    messages = [];
    clearMessages();
    const saved = loadHistory(topic, m);
    if (saved && saved.length >= 2) {
      messages = saved;
      renderAllMessages();
    } else {
      const t = topics[topic];
      const openers = {
        learn: `Объясни тему "${t.title}" с нуля.`,
        quiz:  `Начнём квиз по теме "${t.title}".`,
        mock:  'Начнём mock-интервью. Я готов.',
      };
      autoStart(openers[m]);
    }
  }
}

// ── Cheatsheet ──
function renderCheatsheet(tid) {
  const t = topics[tid];
  if (!t) return;
  const view = document.getElementById('cheatsheet-view');
  if (!view) return;
  view.style.display = 'flex';
  view.style.flexDirection = 'column';

  let body = '';
  if (Array.isArray(t.cheatsheet_blocks) && t.cheatsheet_blocks.length) {
    body = t.cheatsheet_blocks.map(renderCsBlock).join('');
  } else if (Array.isArray(t.cheatsheet)) {
    const color = t.track === 'ml' ? '#22c55e' : '#a78bfa';
    body = t.cheatsheet.map((pair) => `
      <div class="cs-card">
        <div class="cs-q" style="color:${color}">${pair.q}</div>
        <div class="cs-a">${pair.a}</div>
      </div>
    `).join('');
  }

  view.innerHTML = `<div class="cs-header">${t.emoji} ${t.title}</div>${body}`;

  if (window.hljs) {
    view.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  }
  if (typeof addTooltips === 'function') addTooltips(view);
}

// ── Cheatsheet block rendering ──
function renderCsBlock(b) {
  switch (b.type) {
    case 'tldr':    return renderCsTldr(b);
    case 'code':    return renderCsCode(b);
    case 'table':   return renderCsTable(b);
    case 'compare': return renderCsCompare(b);
    case 'list':    return renderCsList(b);
    case 'callout': return renderCsCallout(b);
    case 'flow':    return renderCsFlow(b);
    case 'matrix':  return renderCsMatrix(b);
    case 'kv':      return renderCsKv(b);
    default:        return '';
  }
}

function csInline(s) {
  if (typeof s !== 'string') return '';
  try { return marked.parseInline(stripCJK(s)); }
  catch { return csEscape(s); }
}

function csEscape(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function csTitle(b) {
  return b.title ? `<div class="cs-block-title">${csInline(b.title)}</div>` : '';
}

function renderCsTldr(b) {
  return `<div class="cs-block cs-tldr">${renderMarkdown(b.content || '')}</div>`;
}

function renderCsCode(b) {
  const cap  = b.caption ? `<div class="cs-code-caption">${csInline(b.caption)}</div>` : '';
  const lang = b.lang || 'plaintext';
  return `<div class="cs-block cs-code">${cap}<pre><code class="language-${csEscape(lang)}">${csEscape(b.code || '')}</code></pre></div>`;
}

function renderCsTable(b) {
  const head = (b.headers || []).map(h => `<th>${csInline(h)}</th>`).join('');
  const rows = (b.rows || []).map(r =>
    `<tr>${(r || []).map(c => `<td>${csInline(c)}</td>`).join('')}</tr>`
  ).join('');
  const note = b.note ? `<div class="cs-block-note">${csInline(b.note)}</div>` : '';
  return `<div class="cs-block cs-table-wrap">${csTitle(b)}<table class="cs-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${note}</div>`;
}

function renderCsCompare(b) {
  const items = b.items || [];
  const cols = items.map(it => {
    const points = (it.points || []).map(p => `<li>${csInline(p)}</li>`).join('');
    const titleStyle = it.color ? ` style="color:${csEscape(it.color)}"` : '';
    return `<div class="cs-compare-col"><div class="cs-compare-title"${titleStyle}>${csInline(it.title || '')}</div><ul>${points}</ul></div>`;
  }).join('');
  return `<div class="cs-block cs-compare">${csTitle(b)}<div class="cs-compare-grid">${cols}</div></div>`;
}

function renderCsList(b) {
  const kind = b.kind || 'plain';
  const tag  = kind === 'steps' ? 'ol' : 'ul';
  const items = (b.items || []).map(it => `<li>${csInline(it)}</li>`).join('');
  return `<div class="cs-block cs-list cs-list-${csEscape(kind)}">${csTitle(b)}<${tag}>${items}</${tag}></div>`;
}

function renderCsCallout(b) {
  const kind = b.kind || 'tip';
  const icons = {warning: '⚠️', tip: '💡', fact: '📌', gotcha: '🪤'};
  const icon = icons[kind] || '📌';
  return `<div class="cs-block cs-callout cs-callout-${csEscape(kind)}"><span class="cs-callout-icon">${icon}</span><div class="cs-callout-body">${renderMarkdown(b.content || '')}</div></div>`;
}

function renderCsFlow(b) {
  const renderBr = (br, depth = 0) => {
    const cond = br.condition ? `<span class="cs-flow-cond">${csInline(br.condition)}</span>` : '';
    const arrow = br.outcome ? `<span class="cs-flow-arrow">→</span>` : '';
    const out = br.outcome ? `<span class="cs-flow-out">${csInline(br.outcome)}</span>` : '';
    const kids = (br.children || []).map(c => renderBr(c, depth + 1)).join('');
    return `<div class="cs-flow-branch" style="margin-left:${depth * 18}px">${cond}${arrow}${out}</div>${kids}`;
  };
  const branches = (b.branches || []).map(br => renderBr(br)).join('');
  return `<div class="cs-block cs-flow">${csTitle(b)}${branches}</div>`;
}

function renderCsMatrix(b) {
  const cols = b.cols || [];
  const rows = b.rows || [];
  const cells = b.cells || [];
  const meta = b.cellMeta || [];
  const headRow = `<tr><th></th>${cols.map(c => `<th>${csInline(c)}</th>`).join('')}</tr>`;
  const bodyRows = rows.map((rowLabel, i) => {
    const cs = (cells[i] || []).map((cell, j) => {
      const m = meta[i]?.[j];
      const cls = m?.class ? ` class="cs-matrix-${csEscape(m.class)}"` : '';
      return `<td${cls}>${csInline(cell)}</td>`;
    }).join('');
    return `<tr><th>${csInline(rowLabel)}</th>${cs}</tr>`;
  }).join('');
  return `<div class="cs-block cs-matrix-wrap">${csTitle(b)}<table class="cs-matrix">${headRow}${bodyRows}</table></div>`;
}

function renderCsKv(b) {
  const items = (b.items || []).map(it =>
    `<div class="cs-kv-row"><dt>${csInline(it.k || '')}</dt><dd>${csInline(it.v || '')}</dd></div>`
  ).join('');
  return `<div class="cs-block cs-kv">${csTitle(b)}<dl>${items}</dl></div>`;
}

// ── MC Quiz ──
function renderMCQuiz(tid) {
  const t = topics[tid];
  if (!t || !t.cheatsheet || t.cheatsheet.length < 4) return;
  const view = document.getElementById('mcquiz-view');
  if (!view) return;
  view.style.display = 'flex';
  view.style.flexDirection = 'column';

  const pairs = [...t.cheatsheet].sort(() => Math.random() - 0.5);
  const color = t.track === 'ml' ? '#22c55e' : '#a78bfa';
  let idx = 0, score = 0;

  function showQuestion() {
    if (idx >= pairs.length) { showScore(); return; }
    const pair = pairs[idx];
    const others = pairs.filter((_, i) => i !== idx);
    const wrong = others.sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.a);
    const options = [pair.a, ...wrong].sort(() => Math.random() - 0.5);
    const pct = Math.round((idx / pairs.length) * 100);

    view.innerHTML = `
      <div class="mc-wrap">
        <div class="mc-progress">
          <span>${idx + 1} / ${pairs.length}</span>
          <span style="color:${color}">${score} правильных</span>
        </div>
        <div class="mc-progress-bar">
          <div class="mc-progress-bar-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <div class="mc-question" style="color:${color}">${pair.q}</div>
        <div class="mc-options">
          ${options.map(opt => `<button class="mc-btn" onclick="mcAnswer(this,'${escQ(opt)}','${escQ(pair.a)}')">${opt}</button>`).join('')}
        </div>
        <div class="mc-explain" id="mc-explain" style="display:none">${pair.a}</div>
        <button class="mc-next-btn" id="mc-next" style="display:none;background:${color}" onclick="mcNext()">Следующий →</button>
      </div>
    `;
  }

  function showScore() {
    const emoji = score === pairs.length ? '🏆' : score >= pairs.length * 0.7 ? '💪' : '📚';
    view.innerHTML = `
      <div class="mc-wrap">
        <div class="mc-score">
          <div style="font-size:48px">${emoji}</div>
          <div class="mc-score-num" style="color:${color}">${score}/${pairs.length}</div>
          <div class="mc-score-label">${scoreLabel(score, pairs.length)}</div>
          <button class="mc-restart-btn" style="background:${color}" onclick="renderMCQuiz('${tid}')">Пройти заново</button>
          <button class="mc-restart-btn" style="background:var(--bg-panel);color:var(--text);border:1px solid var(--border)" onclick="setMode('cheatsheet')">Открыть чит-шит</button>
        </div>
      </div>
    `;
  }

  window.mcAnswer = function(btn, chosen, correct) {
    document.querySelectorAll('.mc-btn').forEach(b => b.disabled = true);
    if (chosen === correct) {
      btn.classList.add('correct');
      score++;
    } else {
      btn.classList.add('wrong');
      document.querySelectorAll('.mc-btn').forEach(b => {
        if (b.textContent === correct) b.classList.add('correct');
      });
    }
    document.getElementById('mc-explain').style.display = 'block';
    document.getElementById('mc-next').style.display = 'block';
  };

  window.mcNext = function() { idx++; showQuestion(); };

  showQuestion();
}

function escQ(s) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function scoreLabel(s, t) {
  if (s === t) return 'Идеально! Тема отработана.';
  if (s >= t * 0.8) return 'Отлично! Остались мелкие пробелы.';
  if (s >= t * 0.6) return 'Неплохо, но стоит повторить.';
  return 'Нужно ещё поработать над темой.';
}

// ── Quick actions ──
function renderQuickActions() {
  const el = document.getElementById('quick-area');
  el.innerHTML = '';
  for (const a of (QUICK[mode] || [])) {
    const btn = document.createElement('button');
    btn.className   = 'qbtn';
    btn.textContent = a.label;
    btn.onclick     = () => { if (a.action) a.action(); else send(a.msg); };
    el.appendChild(btn);
  }
  const isStatic = mode === 'cheatsheet' || mode === 'mcquiz';
  if (!isStatic && messages.length > 0) {
    const share = document.createElement('button');
    share.className = 'qbtn';
    share.style.marginLeft = 'auto';
    share.textContent = '🔗 Поделиться';
    share.onclick = onShareClick;
    el.appendChild(share);
  }
}

// ── Sharing ──
async function onShareClick() {
  if (!topic || !messages.length) return;
  try {
    const url = await window.shareApi.createShare({
      v: 1,
      topic_id: topic,
      mode,
      messages,
    });
    await navigator.clipboard.writeText(url);
    toast('Ссылка скопирована');
  } catch (e) {
    toast('Не получилось: ' + (e.message || 'ошибка'));
  }
}

function toast(text) {
  let el = document.getElementById('share-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'share-toast';
    el.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:10px 18px; border-radius:8px; background:#1f2937; color:#fff; font-size:14px; z-index:1000; opacity:0; transition:opacity 0.2s; pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// ── Send ──
async function send(text) {
  if (streaming) return;
  const inp = document.getElementById('user-input');
  const msg = text ?? inp.value.trim();
  if (!msg) return;
  if (!text) { inp.value = ''; resize(inp); }
  if (!topic) {
    appendBubble('ai', 'Сначала выбери тему слева 👈');
    return;
  }
  document.getElementById('welcome')?.remove();
  appendBubble('user', msg);
  messages.push({ role: 'user', content: msg });
  streaming = true;
  setSend(false);
  const bubble = appendBubble('ai', null);
  try {
    const res    = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, topic_id: topic, mode, model: getPreferredModel() }),
    });
    const aiText = await streamInto(res, bubble);
    messages.push({ role: 'assistant', content: aiText });
    saveHistory(topic, mode, messages);
    renderSidebar();
    renderQuickActions();
  } catch (e) {
    bubble.innerHTML = `<em style="color:#ef4444">Ошибка: ${e.message}</em>`;
  }
  streaming = false;
  setSend(true);
}

// ── Stream ──
async function streamInto(response, bubble) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '', buffer = '';
  let thinking = '', thinkEl = null;

  function ensureThinkEl() {
    if (!thinkEl) {
      thinkEl = document.createElement('div');
      thinkEl.className = 'thinking-preview';
      bubble.appendChild(thinkEl);
    }
    return thinkEl;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.thinking) {
          thinking += parsed.thinking;
          ensureThinkEl().textContent = thinking;
          scrollBottom();
        } else if (parsed.text) {
          // Реальный ответ начался — стираем preview рассуждения.
          if (thinkEl) { thinkEl.remove(); thinkEl = null; thinking = ''; }
          full += parsed.text;
          bubble.innerHTML = renderMarkdown(full);
          attachCodeButtons(bubble);
          scrollBottom();
        }
      } catch (_) {}
    }
  }
  // Если поток закрылся, а текста так и не пришло (случай fallback не сработал) —
  // оставляем preview как есть, пользователь хотя бы что-то видит.
  // Тултипы по терминам — один раз в финале, не на каждом чанке
  addTooltips(bubble);
  addTtsButton(bubble, full);
  addNextButton(bubble);
  return full;
}

// ── Фильтр CJK-иероглифов (баг Llama 8B) ──
// Сохраняем часть ДО первого иероглифа если она >= 3 символов,
// остальное (CJK + хвост) убираем.
// "это最小шая" → "это"   "единица保证" → "единица"   "保证" → ""
function stripCJK(text) {
  return text
    .replace(/([^\s]*?)([\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]+\S*)/g,
      (_, pre, cjkTail) => pre.length >= 3 ? pre : '')
    .replace(/ {2,}/g, ' ');
}

// ── Markdown → HTML с кнопками на код-блоках ──
function renderMarkdown(md) {
  return marked.parse(stripCJK(md));
}

// ── Mobile sidebar ──
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ── Desktop sidebar collapse ──
function toggleDesktopSidebar() {
  const sb = document.querySelector('.sidebar');
  const btn = document.getElementById('sidebar-toggle');
  const collapsed = sb.classList.toggle('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
  localStorage.setItem('mlops_sidebar_collapsed', collapsed ? '1' : '');
}
(function restoreDesktopSidebar() {
  if (localStorage.getItem('mlops_sidebar_collapsed') === '1') {
    document.querySelector('.sidebar').classList.add('collapsed');
    const btn = document.getElementById('sidebar-toggle');
    if (btn) btn.textContent = '▶';
  }
})();

// ── Tooltip controller (universal: hover + tap) ──
(function setupTooltip() {
  const tip = document.getElementById('tooltip');
  const isTouch = window.matchMedia('(hover: none)').matches;
  let pinnedTerm = null; // на тач-устройствах: какой термин «прикреплён»

  function showFor(term) {
    if (!term.dataset.tooltip) return;
    tip.textContent = term.dataset.tooltip;
    tip.classList.add('show');
    positionTip(term, tip);
  }
  function hide() {
    tip.classList.remove('show');
    pinnedTerm = null;
  }

  if (isTouch) {
    // На тач: тап по термину — показать; тап вне термина — скрыть
    document.addEventListener('click', (e) => {
      const term = e.target.closest('.gloss-term');
      if (term && term.dataset.tooltip) {
        if (pinnedTerm === term) { hide(); return; }
        pinnedTerm = term;
        showFor(term);
      } else {
        hide();
      }
    });
  } else {
    // Десктоп: hover
    document.addEventListener('mouseover', (e) => {
      const term = e.target.closest('.gloss-term');
      if (term) showFor(term);
    });
    document.addEventListener('mouseout', (e) => {
      const term = e.target.closest('.gloss-term');
      if (term) hide();
    });
  }

  // Скролл — скрываем (позиция уже неактуальна)
  document.addEventListener('scroll', hide, true);

  function positionTip(term, tip) {
    const r = term.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const margin = 8;
    let left = r.left + r.width / 2 - tw / 2;
    let top  = r.top - th - margin;
    if (left < margin) left = margin;
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - tw - margin;
    if (top < margin) top = r.bottom + margin;
    tip.style.left = left + 'px';
    tip.style.top  = top + 'px';
  }
})();

// ── Glossary tooltips ──
let GLOSS_REGEX = null;
function buildGlossRegex() {
  if (GLOSS_REGEX || !window.GLOSSARY) return GLOSS_REGEX;
  const terms = Object.keys(window.GLOSSARY).sort((a, b) => b.length - a.length);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b плохо работает с кириллицей, поэтому используем (?<![\wа-яёА-ЯЁ])X(?![\wа-яёА-ЯЁ])
  const pattern = '(?<![\\wа-яёА-ЯЁ])(' + terms.map(escape).join('|') + ')(?![\\wа-яёА-ЯЁ])';
  GLOSS_REGEX = new RegExp(pattern, 'g');
  return GLOSS_REGEX;
}

function findDef(term) {
  if (window.GLOSSARY[term]) return window.GLOSSARY[term];
  // case-insensitive fallback
  const lower = term.toLowerCase();
  const key = Object.keys(window.GLOSSARY).find(k => k.toLowerCase() === lower);
  return key ? window.GLOSSARY[key] : null;
}

function addTooltips(bubble) {
  if (!window.GLOSSARY) return;
  const re = buildGlossRegex();
  if (!re) return;

  // Собираем все текстовые узлы вне code/pre/уже обёрнутых терминов
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p && p !== bubble) {
        const tag = p.tagName;
        if (tag === 'CODE' || tag === 'PRE' || tag === 'A' ||
            p.classList.contains('gloss-term')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const tn of nodes) {
    const text = tn.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement('span');
      span.className = 'gloss-term';
      span.textContent = m[0];
      const def = findDef(m[0]);
      if (def) span.dataset.tooltip = def;
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    tn.parentNode.replaceChild(frag, tn);
  }
}

function attachCodeButtons(bubble) {
  // Оборачиваем каждый <pre> в .code-wrap и добавляем кнопку
  bubble.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-wrap')) return; // уже обёрнут
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    // Подсветка
    pre.querySelectorAll('code').forEach(el => hljs.highlightElement(el));

    // Кнопка разобрать
    const btn = document.createElement('button');
    btn.className   = 'code-explain-btn';
    btn.textContent = '🔍 Разобрать';
    btn.onclick     = () => {
      const code = pre.querySelector('code')?.innerText || pre.innerText;
      send(`Разбери эту команду/конфиг построчно — объясни каждую часть простыми словами:\n\`\`\`\n${code}\n\`\`\``);
    };
    wrap.appendChild(btn);
  });
}

// ── DOM helpers ──
function appendBubble(role, content) {
  const wrap = document.getElementById('messages');
  document.getElementById('welcome')?.remove();
  const row = document.createElement('div');
  row.className = `msg${role === 'user' ? ' user' : ''}`;
  const av = document.createElement('div');
  av.className  = `avatar ${role === 'user' ? 'user' : 'ai'}`;
  av.textContent = role === 'user' ? '👤' : '🤖';
  const bub = document.createElement('div');
  bub.className = 'bubble';
  if (content === null) {
    bub.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  } else if (role === 'user') {
    bub.textContent = content;
  } else {
    bub.innerHTML = renderMarkdown(content);
    attachCodeButtons(bub);
    addTooltips(bub);
    addTtsButton(bub, content);
  }
  row.appendChild(av);
  row.appendChild(bub);
  wrap.appendChild(row);
  scrollBottom();
  return bub;
}

function clearMessages() { document.getElementById('messages').innerHTML = ''; }
function scrollBottom()  { const el = document.getElementById('messages'); el.scrollTop = el.scrollHeight; }
function setSend(on) {
  document.getElementById('send-btn').disabled = !on;
  document.querySelectorAll('.qbtn').forEach(b => b.disabled = !on);
}
function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
function resize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

// ── TTS / edge-tts ──
let ttsAudio = null;
let ttsBtn   = null;
let ttsUrl   = null;

function addTtsButton(bubble, rawText) {
  const btn = document.createElement('button');
  btn.className = 'tts-btn';
  btn.innerHTML = '🔊 <span>Слушать</span>';
  btn.title = 'Прочитать вслух';
  btn.onclick = () => speak(rawText, btn);
  bubble.appendChild(btn);
}

function addNextButton(bubble) {
  if (mode !== 'learn' && mode !== 'quiz' && mode !== 'mock') return;
  const isLearn = mode === 'learn';
  const btn = document.createElement('button');
  btn.className = 'next-q-btn';
  btn.innerHTML = isLearn ? '➡️ <span>Далее</span>' : '➡️ <span>Следующий</span>';
  btn.title = isLearn ? 'Продолжить объяснение' : 'Следующий вопрос';
  btn.onclick = () => send(isLearn ? 'Далее.' : 'Следующий вопрос.');
  bubble.appendChild(btn);
}

function ttsSetState(btn, state) {
  if (!btn) return;
  btn.classList.remove('tts-loading', 'tts-playing', 'tts-paused');
  if (state === 'idle')    btn.innerHTML = '🔊 <span>Слушать</span>';
  if (state === 'loading') { btn.innerHTML = '⏳ <span>Загрузка…</span>';   btn.classList.add('tts-loading'); }
  if (state === 'playing') { btn.innerHTML = '⏸ <span>Пауза</span>';        btn.classList.add('tts-playing'); }
  if (state === 'paused')  { btn.innerHTML = '▶ <span>Продолжить</span>';   btn.classList.add('tts-paused');  }
}

function ttsReset() {
  if (ttsAudio) { try { ttsAudio.pause(); } catch {} }
  if (ttsUrl)   { URL.revokeObjectURL(ttsUrl); ttsUrl = null; }
  ttsAudio = null;
  if (ttsBtn)   { ttsSetState(ttsBtn, 'idle'); ttsBtn = null; }
}

async function speak(rawText, btn) {
  // Тоггл паузы/возобновления для той же кнопки — без нового запроса.
  if (ttsAudio && ttsBtn === btn) {
    if (ttsAudio.paused) {
      try { await ttsAudio.play(); ttsSetState(btn, 'playing'); } catch { ttsReset(); }
    } else {
      ttsAudio.pause();
      ttsSetState(btn, 'paused');
    }
    return;
  }
  // Другая кнопка или ничего не играет — сбрасываем старое и грузим новое.
  ttsReset();

  const plain = rawText
    .replace(/_\(резервная модель:[^)]+\)_/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/[#*`_~\[\]]/g, '')
    .replace(/\n+/g, ' ').trim();
  ttsBtn = btn;
  ttsSetState(btn, 'loading');
  try {
    const res  = await fetch('/api/tts', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: plain.slice(0, 3000)}),
    });
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    ttsUrl     = url;
    ttsAudio   = new Audio(url);
    const cleanup = () => {
      if (ttsBtn === btn) {
        if (ttsUrl) { URL.revokeObjectURL(ttsUrl); ttsUrl = null; }
        ttsAudio = null;
        ttsSetState(btn, 'idle');
        ttsBtn = null;
      }
    };
    ttsAudio.onended = cleanup;
    ttsAudio.onerror = cleanup;
    await ttsAudio.play();
    ttsSetState(btn, 'playing');
  } catch (e) {
    ttsReset();
  }
}

// ── Mic / Groq Whisper ──
let mediaRecorder = null;
let audioChunks   = [];

async function micStart(e) {
  if (e) e.preventDefault();
  if (mediaRecorder) return;
  const btn = document.getElementById('mic-btn');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();
    btn.classList.add('recording');
    btn.textContent = '⏹';
  } catch {
    btn.textContent = '🚫';
    setTimeout(() => { btn.textContent = '🎙'; }, 2000);
  }
}

async function micStop() {
  if (!mediaRecorder) return;
  const btn = document.getElementById('mic-btn');
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());
  mediaRecorder.onstop = async () => {
    mediaRecorder = null;
    btn.classList.remove('recording');
    btn.textContent = '⏳';
    const ext  = audioChunks[0]?.type.includes('ogg') ? 'ogg' : audioChunks[0]?.type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });
    const form = new FormData();
    form.append('audio', blob, `rec.${ext}`);
    try {
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (data.text) {
        const inp = document.getElementById('user-input');
        inp.value = data.text;
        resize(inp);
        inp.focus();
      }
    } catch { /* тихо игнорируем */ }
    btn.textContent = '🎙';
  };
}

init();

// При появлении клавиатуры скроллим чат вниз.
// Высоту body не трогаем — interactive-widget=resizes-content + 100dvh
// сами разрулят layout без JS.
if (window.visualViewport) {
  let lastH = window.visualViewport.height;
  window.visualViewport.addEventListener('resize', () => {
    const newH = window.visualViewport.height;
    if (lastH - newH > 100) setTimeout(scrollBottom, 50);
    lastH = newH;
  });
}
