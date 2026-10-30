const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? esc(url.href) : '#';
  } catch {
    return '#';
  }
};

const STATUS = { open: '报名中', soon: '即将报名', upcoming: '下一届预告' };
const STATUS_RANK = { open: 0, soon: 1, upcoming: 2 };
const FEE_RANK = { free: 0, paid: 1, unknown: 2 };
let data = null;

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function startKey(item) {
  const match = item.date.match(/(20\d{2})(?:-| 年 )(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : '9999-99';
}

function deadlineKey(item) {
  return item.deadline || startKey(item);
}

function sortedCompetitions() {
  return [...data.competitions].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus) return byStatus;
    const byDate = deadlineKey(a).localeCompare(deadlineKey(b));
    if (byDate) return byDate;
    if (a.feeType !== b.feeType) return FEE_RANK[a.feeType] - FEE_RANK[b.feeType];
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

function renderMeta(list) {
  const free = list.filter((item) => item.feeType === 'free').length;
  const paid = list.filter((item) => item.feeType === 'paid').length;
  const unknown = list.filter((item) => item.feeType === 'unknown').length;
  $('#meta').innerHTML = [
    `更新 <b>${esc(data.verifiedDate.replaceAll('-', '.'))}</b>`,
    `<b>${list.length}</b> 项`,
    `已核实免费 <b>${free}</b>`,
    `写明收费 <b>${paid}</b>`,
    `待核实 <b>${unknown}</b>`,
  ].map((text) => `<span>${text}</span>`).join('');
  $('#updated').textContent = data.verifiedDate;
}

function renderNow(list) {
  const picks = list
    .filter((item) => item.status !== 'upcoming')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .slice(0, 4);
  const section = $('#now');
  if (!picks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  section.innerHTML = '<span class="now-label">近期可报</span>' + picks.map((item) => `
    <a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">
      <b>${esc(item.name)}</b>
      <small>${esc(STATUS[item.status])} · ${esc(item.now || item.dateNote)}</small>
    </a>`).join('');
}

function renderAwards(list) {
  const picks = list.filter((item) => item.tags.some((tag) => /获奖率|省奖|个奖/.test(tag)));
  const section = $('#awards');
  if (!picks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  section.innerHTML = '<span class="now-label">获奖率/名额已知</span>' + picks.map((item) => {
    const tag = item.tags.find((value) => /获奖率|省奖|个奖/.test(value));
    const prize = item.prize.split('；')[0];
    return `<a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">
      <b>${esc(item.name)}</b>
      <small>${esc(tag)} · ${esc(prize)}</small>
    </a>`;
  }).join('');
}

function renderTable(list) {
  $('#rows').innerHTML = list.map((item) => {
    const feeClass = item.feeType;
    const feeText = item.feeType === 'free' ? '已核实免费' : item.feeType === 'paid' ? '收费' : '待核实';
    const feeDetail = item.feeType === 'free'
      ? esc(item.feeNote)
      : `<b>${esc(item.fee)}</b><br>${esc(item.feeNote)}`;
    return `<tr>
      <td data-label="比赛">
        <span class="comp-name">${esc(item.name)}</span>
        <span class="comp-org">${esc(item.organizer)}</span>
        <div class="tags">${item.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}${item.path === 'school' ? '<span class="tag warn">需校赛</span>' : ''}</div>
      </td>
      <td data-label="主要内容"><p class="summary">${esc(item.summary)}</p></td>
      <td data-label="日期">
        <span class="date-main">${esc(item.date)}</span>
        <span class="date-note">${esc(item.dateNote)}</span>
        <span class="status ${item.status}">${esc(STATUS[item.status])}</span>
      </td>
      <td data-label="奖金"><p class="prize">${esc(item.prize)}</p></td>
      <td data-label="费用">
        <span class="fee ${feeClass}">${feeText}</span>
        <span class="fee-note">${feeDetail}</span>
      </td>
      <td data-label="官网">
        <div class="links">
          <a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">官网 ↗</a>
          <a class="evidence" href="${safeUrl(item.evidence.url)}" target="_blank" rel="noopener noreferrer">费用依据</a>
        </div>
      </td>
    </tr>`;
  }).join('');
  $('#table-note').textContent = '按最早报名/提交截止排：报名中 → 即将报名 → 下一届；同月免费优先';
}

function monitorClass(source, result) {
  if (!source.monitorUrl) return 'manual';
  if (!result) return '';
  if (result.status !== 'ok') return 'error';
  return result.changed ? 'changed' : 'ok';
}

function monitorText(source, result) {
  if (!source.monitorUrl) return '手动入口 · 回官网核实';
  if (!result) return '本次未检查';
  if (result.status !== 'ok') return `需人工打开 · ${result.message || '页面不可读'}`;
  if (result.via === 'reader') return result.changed ? '阅读代理读取 · 有变化' : '阅读代理读取 · 暂未发现变化';
  if (result.changed) return '发现页面变化 · 需人工确认';
  return '可访问 · 暂未发现变化';
}

function renderSources() {
  const monitor = data.monitor || { checkedAt: null, results: [] };
  const results = new Map((monitor.results || []).map((item) => [item.id, item]));
  const automatic = data.sources.filter((item) => item.monitorUrl);
  const ok = automatic.filter((item) => results.get(item.id)?.status === 'ok').length;
  const changed = automatic.filter((item) => results.get(item.id)?.changed).length;
  const manual = automatic.length - ok;

  $('#source-count').textContent = monitor.checkedAt
    ? `${data.sources.length} 个入口 · 上次 ${formatTime(monitor.checkedAt)}`
    : `${data.sources.length} 个入口 · 尚未检查`;
  $('#monitor-note').textContent = monitor.checkedAt
    ? `自动检查 ${automatic.length} 个：${ok} 个可读取，${changed} 个有变化，${manual} 个需人工`
    : `共 ${data.sources.length} 个入口，其中 ${automatic.length} 个可自动检查；先点一次建立基线。`;

  const mainSources = data.sources.filter((source) => !source.more);
  const moreSources = data.sources.filter((source) => source.more);

  $('#source-grid').innerHTML = mainSources.map((source) => {
    const result = results.get(source.id);
    const cls = monitorClass(source, result);
    const link = result?.changed && result.links?.[0]
      ? `<a class="source-new" href="${safeUrl(result.links[0].url)}" target="_blank" rel="noopener noreferrer">新：${esc(result.links[0].title)}</a>`
      : '';
    return `<article class="source">
      <div class="source-head">
        <a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>
        <i class="dot ${cls}" title="${esc(monitorText(source, result))}"></i>
      </div>
      <span class="source-platform">${esc(source.platform)} · ${source.monitorUrl ? '自动检查' : '手动'}</span>
      <p>${esc(source.description)}</p>
      <span class="source-check">${esc(monitorText(source, result))}</span>
      ${link}
    </article>`;
  }).join('');

  const more = $('#more-sources');
  if (!moreSources.length) {
    more.hidden = true;
    return;
  }
  more.hidden = false;
  more.innerHTML = '<span class="more-label">更多平台入口</span>' + moreSources.map((source) => (
    `<a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`
  )).join('');
}

function render() {
  const list = sortedCompetitions();
  renderMeta(list);
  renderNow(list);
  renderAwards(list);
  renderTable(list);
  renderSources();
}

async function checkSources() {
  const button = $('#check');
  button.disabled = true;
  button.textContent = '检查中…';
  $('#monitor-note').textContent = '正在读取公开页面，可能需要 10–30 秒…';
  try {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '检查失败');
    const previous = new Map((data.monitor?.results || []).map((item) => [item.id, item]));
    for (const item of payload.results) {
      const before = previous.get(item.id);
      item.changed = Boolean(item.status === 'ok' && before?.fingerprint && before.fingerprint !== item.fingerprint);
    }
    data.monitor = { checkedAt: new Date().toISOString(), results: payload.results };
    renderSources();
  } catch (error) {
    $('#monitor-note').textContent = error.message || '检查失败，请稍后再试。';
  } finally {
    button.disabled = false;
    button.textContent = '检查更新';
  }
}

const API_STORE = 'shisai:api-sources';
const API_CHECKS = 'shisai:api-checks';

function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 浏览器禁用存储时只保留内存状态
  }
}

let apiSources = readStore(API_STORE, []);
let apiChecks = readStore(API_CHECKS, {});
if (!Array.isArray(apiSources)) apiSources = [];
if (!apiChecks || typeof apiChecks !== 'object' || Array.isArray(apiChecks)) apiChecks = {};

function getPath(value, path) {
  if (!path) return value;
  return path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function apiValue(item, field, fallbacks) {
  const custom = field ? getPath(item, field) : undefined;
  if (custom != null && custom !== '') return custom;
  for (const key of fallbacks) {
    const value = getPath(item, key);
    if (value != null && value !== '') return value;
  }
  return '';
}

function normalizeApiItem(item, source) {
  if (typeof item === 'string') return { title: item.slice(0, 160), url: '', date: '', prize: '' };
  if (!item || typeof item !== 'object') return null;
  const title = apiValue(item, source.fields?.title, ['title', 'name', 'competition', 'contest']);
  if (!title) return null;
  const rawUrl = apiValue(item, source.fields?.url, ['url', 'link', 'href']);
  let url = '';
  try {
    url = rawUrl ? new URL(String(rawUrl), source.url).href : '';
  } catch {
    url = '';
  }
  return {
    title: String(title).slice(0, 160),
    url,
    date: String(apiValue(item, source.fields?.date, ['date', 'deadline', 'start', 'time'])).slice(0, 60),
    prize: String(apiValue(item, source.fields?.prize, ['prize', 'bonus', 'award'])).slice(0, 80),
  };
}

function renderApiSources() {
  const list = $('#api-list');
  if (!list) return;
  if (!apiSources.length) {
    list.innerHTML = '<p class="api-empty">还没有 API 源。填上面的表单，添加一个返回 JSON 的接口。</p>';
    return;
  }
  list.innerHTML = apiSources.map((source) => {
    const check = apiChecks[source.id];
    const status = !check ? '未检查' : check.error ? '检查失败' : check.changed ? '有更新' : '已读取';
    const items = (check?.items || []).slice(0, 6).map((item) => {
      const label = `${esc(item.title)}${item.date ? ` · ${esc(item.date)}` : ''}${item.prize ? ` · ${esc(item.prize)}` : ''}`;
      return item.url
        ? `<a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<span class="api-items"><em>${label}</em></span>`;
    }).join('');
    const error = check?.error ? `<div class="api-empty">${esc(check.error)}</div>` : '';
    return `<article class="api-source">
      <div class="api-source-head">
        <strong>${esc(source.name)}</strong>
        <span>${esc(status)}${check?.checkedAt ? ` · ${esc(formatTime(check.checkedAt))}` : ''}</span>
      </div>
      <small>${esc(source.url)}</small>
      ${items ? `<div class="api-items">${items}</div>` : ''}
      ${error}
      <div class="api-actions">
        <button type="button" data-api-check="${esc(source.id)}">检查</button>
        <button type="button" data-api-del="${esc(source.id)}">删除</button>
      </div>
    </article>`;
  }).join('');
}

async function checkApiSource(source) {
  try {
    const response = await fetch('/api/fetch-json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: source.url, headers: source.headers || {} }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '读取失败');
    const raw = getPath(payload.data, source.path || '');
    const array = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : null);
    if (!array) throw new Error(`数据路径“${source.path || '根'}”没有返回数组`);
    const items = array.slice(0, 50).map((item) => normalizeApiItem(item, source)).filter(Boolean).slice(0, 12);
    const fingerprint = JSON.stringify(items);
    const before = apiChecks[source.id];
    apiChecks[source.id] = {
      checkedAt: new Date().toISOString(),
      fingerprint,
      items,
      changed: Boolean(before?.fingerprint && before.fingerprint !== fingerprint),
    };
  } catch (error) {
    apiChecks[source.id] = {
      checkedAt: new Date().toISOString(),
      error: String(error.message || error).slice(0, 160),
      items: [],
      changed: false,
    };
  }
  saveStore(API_CHECKS, apiChecks);
  renderApiSources();
}

$('#api-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#api-name').value.trim();
  const url = $('#api-url').value.trim();
  let headers = {};
  const rawHeaders = $('#api-headers').value.trim();
  if (rawHeaders) {
    try {
      headers = JSON.parse(rawHeaders);
    } catch {
      $('#api-list').innerHTML = '<p class="api-empty">Headers 不是合法 JSON。</p>';
      return;
    }
  }
  if (!name || !url) return;
  const source = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()),
    name,
    url,
    headers: headers && typeof headers === 'object' && !Array.isArray(headers) ? headers : {},
    path: $('#api-path').value.trim(),
    fields: {
      title: $('#api-title').value.trim() || 'title',
      url: $('#api-link').value.trim() || 'url',
      date: $('#api-date').value.trim() || 'date',
      prize: $('#api-prize').value.trim() || 'prize',
    },
  };
  apiSources.push(source);
  saveStore(API_STORE, apiSources);
  event.target.reset();
  renderApiSources();
  checkApiSource(source);
});

$('#api-list')?.addEventListener('click', (event) => {
  const checkButton = event.target.closest('[data-api-check]');
  if (checkButton) {
    const source = apiSources.find((item) => item.id === checkButton.dataset.apiCheck);
    if (source) checkApiSource(source);
    return;
  }
  const deleteButton = event.target.closest('[data-api-del]');
  if (deleteButton) {
    const source = apiSources.find((item) => item.id === deleteButton.dataset.apiDel);
    if (!source || !confirm(`删除 API 源“${source.name}”？`)) return;
    apiSources = apiSources.filter((item) => item.id !== source.id);
    delete apiChecks[source.id];
    saveStore(API_STORE, apiSources);
    saveStore(API_CHECKS, apiChecks);
    renderApiSources();
  }
});

renderApiSources();

fetch('/api/data')
  .then((response) => {
    if (!response.ok) throw new Error('数据加载失败');
    return response.json();
  })
  .then((payload) => {
    data = payload;
    render();
  })
  .catch(() => {
    $('#rows').innerHTML = '<tr><td colspan="6" class="loading">暂时无法加载赛事表，请刷新页面。</td></tr>';
    $('#meta').textContent = '数据加载失败';
    $('#source-count').textContent = '数据加载失败';
  });

$('#check').addEventListener('click', checkSources);
