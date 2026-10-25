import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { competitions, sources, verifiedDate } from '../lib/radar-data.ts';

const monitor = existsSync('data/monitor.json')
  ? JSON.parse(readFileSync('data/monitor.json', 'utf8'))
  : { checkedAt: null, results: [] };
const data = { competitions, sources, verifiedDate, monitor };
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
};
const assets = Object.fromEntries(
  Object.entries(files).map(([url, [file, type]]) => [url, {
    body: readFileSync(new URL('../public/' + file, import.meta.url), 'utf8'),
    type,
  }]),
);

mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
writeFileSync('dist/.openai/hosting.json', readFileSync('.openai/hosting.json'));
const core = readFileSync('lib/api.mjs', 'utf8');
writeFileSync(
  'dist/server/index.js',
  core
    + '\nconst data=' + JSON.stringify(data) + ';\nconst assets=' + JSON.stringify(assets) + ';\nexport default {async fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith("/api/"))return handleApi(request,env,data);const asset=assets[path];if(!asset)return new Response("Not found",{status:404});if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});return new Response(request.method==="HEAD"?null:asset.body,{headers:{"Content-Type":asset.type,"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":"default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'self\'"}});}};\n'
);
console.log(`Built: ${competitions.length} competitions, ${sources.length} sources, ${monitor.results?.length || 0} monitor records.`);
