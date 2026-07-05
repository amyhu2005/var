const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// DeepSeek API key — set via environment variable or replace the string here.
// Never expose this to the browser; it stays server-side only.
const AI_API_KEY = process.env.DEEPSEEK_API_KEY;
const AI_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  // ── PDF fetch proxy ───────────────────────────────────────────────────────
  // Fetches a remote PDF server-side so the browser avoids CORS restrictions.
  if (req.method === 'GET' && req.url.startsWith('/api/fetch-pdf?')) {
    const params = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
    const target = params.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400); res.end('missing or invalid url param'); return;
    }
    const parsedTarget = new url.URL(target);
    const lib = parsedTarget.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedTarget.hostname,
      path: parsedTarget.pathname + parsedTarget.search,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    };
    lib.get(options, remote => {
      // Follow one level of redirect (common for arXiv, journal PDFs)
      if ((remote.statusCode === 301 || remote.statusCode === 302) && remote.headers.location) {
        const redirectUrl = remote.headers.location.startsWith('http')
          ? remote.headers.location
          : `${parsedTarget.protocol}//${parsedTarget.hostname}${remote.headers.location}`;
        const rParsed = new url.URL(redirectUrl);
        const rLib = rParsed.protocol === 'https:' ? https : http;
        rLib.get({ hostname: rParsed.hostname, path: rParsed.pathname + rParsed.search,
                   headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
          res.writeHead(r2.statusCode, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
          r2.pipe(res);
        }).on('error', err => { res.writeHead(502); res.end(err.message); });
      } else {
        res.writeHead(remote.statusCode, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
        remote.pipe(res);
      }
    }).on('error', err => { res.writeHead(502); res.end(err.message); });
    return;
  }

  // ── AI proxy ──────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/ai') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch {
        res.writeHead(400); res.end('bad JSON'); return;
      }
      const { payload } = parsed;
      if (!AI_API_KEY) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No AI key configured on server. Set DEEPSEEK_API_KEY environment variable.' }));
        return;
      }
      const target = new url.URL(AI_ENDPOINT);
      const data = JSON.stringify(payload);
      const options = {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Authorization': `Bearer ${AI_API_KEY}`,
        },
      };

      const proxy = https.request(options, remote => {
        let out = '';
        remote.on('data', c => out += c);
        remote.on('end', () => {
          res.writeHead(remote.statusCode, { 'Content-Type': 'application/json' });
          res.end(out);
        });
      });
      proxy.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      proxy.write(data);
      proxy.end();
    });
    return;
  }

  // ── Static file server ────────────────────────────────────────────────────
  const reqPath = req.url.split('?')[0]; // strip query params (e.g. OAuth ?code=...)
  let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
    } else {
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(content);
    }
  });

}).listen(PORT, () => {
  const keyStatus = AI_API_KEY ? 'AI key configured ✓' : 'WARNING: no DEEPSEEK_API_KEY set — AI features will be disabled';
  console.log(`Var running at http://localhost:${PORT}  [${keyStatus}]`);
});
