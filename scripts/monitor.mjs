import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { checkSource } from '../lib/api.mjs';
import { sources } from '../lib/radar-data.ts';

const out = 'data/monitor.json';
const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { results: [] };
const prevById = new Map((previous.results || []).map((item) => [item.id, item]));
const targets = sources.filter((source) => source.monitorUrl);
const queue = [...targets];
const results = [];

async function worker() {
  while (queue.length) {
    const source = queue.shift();
    const result = await checkSource(source, fetch);
    const before = prevById.get(source.id);
    result.changed = Boolean(result.status === 'ok' && result.via === 'direct' && before?.fingerprint && before.url === result.url && before.via === 'direct' && before.fingerprint !== result.fingerprint);
    if (result.status !== 'ok' && before?.fingerprint) result.fingerprint = before.fingerprint;
    results.push(result);
  }
}

await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
results.sort((a, b) => sources.findIndex((item) => item.id === a.id) - sources.findIndex((item) => item.id === b.id));
mkdirSync('data', { recursive: true });
const payload = { checkedAt: new Date().toISOString(), results };
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');

const ok = results.filter((item) => item.status === 'ok').length;
const changed = results.filter((item) => item.changed).length;
const failed = results.length - ok;
console.log(`检查 ${results.length} 个信息源：${ok} 个可访问，${changed} 个有变化，${failed} 个失败或需人工。`);
for (const item of results.filter((row) => row.status !== 'ok')) {
  console.log(`- ${item.id}: ${item.message}`);
}
