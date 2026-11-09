const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);
const originalEnhance = config.server?.enhanceMiddleware;
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function copyHeaders(source, extra = {}) {
  const headers = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }
  return { ...headers, ...extra };
}

function fail(res, message) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyToLaravel(req, res) {
  let body = Buffer.alloc(0);
  try {
    body = await readBody(req);
  } catch {
    fail(res, 'Could not read the upload. Please try again.');
    return;
  }

  const forwardedHost = req.headers.host;
  const headers = copyHeaders(req.headers, {
    host: '127.0.0.1:8000',
    'content-length': String(body.length),
  });
  if (forwardedHost) {
    headers['x-forwarded-host'] = forwardedHost;
    headers['x-forwarded-proto'] = 'http';
  }
  delete headers['if-none-match'];
  delete headers['if-modified-since'];

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: 8000,
      path: req.url,
      method: req.method,
      headers,
      timeout: 120000,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, copyHeaders(proxyRes.headers));
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    fail(res, 'The upload timed out. Try a smaller or clearer QR photo.');
  });

  proxyReq.on('error', () => {
    fail(res, 'Cannot reach the Laravel API. Keep php artisan serve running on port 8000.');
  });

  proxyReq.end(body);
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const nextMiddleware = originalEnhance
      ? originalEnhance(middleware, server)
      : middleware;

    return (req, res, nxt) => {
      if (
        typeof req.url === 'string' &&
        (req.url.startsWith('/api') || req.url.startsWith('/storage'))
      ) {
        console.log('[safesakay-proxy]', req.method, req.url);
        void proxyToLaravel(req, res);
        return;
      }

      return nextMiddleware(req, res, nxt);
    };
  },
};

module.exports = config;
