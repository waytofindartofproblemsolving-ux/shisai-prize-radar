import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, announcementLinks, plainText, sanitizeAnalysis, boundedText } from '../lib/api.mjs';
import { competitions, sources, verifiedDate, sortCompetitions, countByFee, deadlineKey } from '../lib/radar-data.ts';

const data = { competitions, sources, verifiedDate, monitor: { checkedAt: null, results: [] } };
const req = (path, body = {}, extra = {}) => new Request('https://test.site' + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'oai-authenticated-user-id': crypto.randomUUID(), ...extra },
  body: JSON.stringify(body),
});

test('every competition states a fee and links to its evidence', () => {
  assert.equal(competitions.length, 26);
  for (const item of competitions) {
    assert.ok(['free', 'paid', 'unknown'].includes(item.feeType), item.id);
    assert.ok(item.fee.length > 0, item.id);
    assert.ok(item.feeNote.length > 0, item.id);
    assert.match(item.evidence.url, /^https?:\/\//, item.id);
    assert.equal(item.checked, verifiedDate, item.id);
  }
  assert.deepEqual(countByFee(), { total: 26, free: 8, paid: 4, unknown: 14 });
  assert.equal(competitions.filter((item) => item.path === 'school').length, 2);
});

test('competitions follow status and time order, with free first in the same month', () => {
  const sorted = sortCompetitions();
  assert.equal(sorted[0].status, 'open');
  const firstSoon = sorted.findIndex((item) => item.status === 'soon');
  const firstUpcoming = sorted.findIndex((item) => item.status === 'upcoming');
  assert.ok(firstSoon > 0);
  assert.ok(firstUpcoming > firstSoon);
  assert.ok(sorted.slice(0, firstUpcoming).every((item) => item.status !== 'upcoming'));

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1].status !== sorted[index].status) continue;
    assert.ok(deadlineKey(sorted[index - 1]) <= deadlineKey(sorted[index]), sorted[index].name);
  }
});

test('ids and official links are unique', () => {
  assert.equal(new Set(competitions.map((item) => item.id)).size, competitions.length);
  assert.equal(new Set(competitions.map((item) => item.url)).size, competitions.length);
});

test('status never exposes credentials', async () => {
  const response = await handleApi(new Request('https://test.site/api/status'), { DEEPSEEK_API_KEY: 'secret-test' }, data);
  const text = await response.text();
  assert.ok(!text.includes('secret-test'));
  assert.equal(JSON.parse(text).configured, true);
});

test('missing key never invokes provider', async () => {
  let called = false;
  const response = await handleApi(req('/api/analyze'), {}, data, () => { called = true; });
  assert.equal(response.status, 503);
  assert.equal(called, false);
});

test('reject unauthenticated and cross-origin requests', async () => {
  assert.equal((await handleApi(new Request('https://test.site/api/check', { method: 'POST' }), {}, data)).status, 401);
  assert.equal((await handleApi(req('/api/check', {}, { origin: 'https://attacker.test' }), {}, data)).status, 403);
});

test('source checker only visits configured sources and tolerates failures', async () => {
  const visited = [];
  const response = await handleApi(req('/api/check'), {}, data, async (url) => {
    if (url.startsWith('https://r.jina.ai/')) throw new Error('blocked');
    visited.push(url);
    if (url.includes('tianchi')) throw new Error('offline');
    return new Response('<html><p>' + ('比赛信息 奖金 赛题 '.repeat(30)) + '</p><a href="/news">新赛题报名</a></html>', {
      headers: { 'content-type': 'text/html' },
    });
  });
  const payload = await response.json();
  const monitored = sources.filter((item) => item.monitorUrl).length;
  assert.equal(visited.length, monitored);
  assert.ok(visited.every((url) => sources.some((item) => item.monitorUrl === url)));
  assert.equal(payload.results.filter((item) => item.status === 'ok').length, monitored - 1);
  assert.equal(payload.results.filter((item) => item.status === 'error').length, 1);
});

test('unsafe link schemes and offsite links are not collected', () => {
  const links = announcementLinks('<a href="javascript:alert(1)">比赛</a><a href="https://attacker.test/">赛题</a><a href="/news">报名 &amp; 赛题</a>', 'https://test.site/');
  assert.deepEqual(links, [{ title: '报名 & 赛题', url: 'https://test.site/news' }]);
});

test('active script text is excluded from source fingerprint', () => {
  assert.equal(plainText('<script>alert(1)</script><p>报名</p><style>bad</style>'), '报名');
});

test('oversized and malformed model outputs fail closed', async () => {
  await assert.rejects(() => boundedText(new Response('1234567890'), 5));
  assert.throws(() => sanitizeAnalysis({ title: 'x' }));
});

test('model integration only sends to DeepSeek and returns unverified schema', async () => {
  const output = {
    title: '测试比赛', category: '数据分析', summary: '数据复现', prizeNote: '待核实',
    costNote: '待核实', fitReason: '线上可完成', aiNote: '待核实',
  };
  let called = false;
  const response = await handleApi(
    req('/api/analyze', { text: '测试公告，数据分析案例复现大赛，报名与奖金情况待核实。', url: 'https://example.org/' }),
    { DEEPSEEK_API_KEY: 'test' },
    data,
    async (url, options) => {
      called = true;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer test');
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
    },
  );
  const payload = await response.json();
  assert.equal(called, true);
  assert.equal(response.status, 200);
  assert.equal(payload.verified, false);
  assert.equal(payload.fee, undefined);
});
