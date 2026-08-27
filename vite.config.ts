import dns from 'dns';
import type {IncomingMessage} from 'http';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

dns.setDefaultResultOrder('ipv4first');

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec';

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const KIRKE_ICAL_URL =
  "https://lillesandmisjonskirke.no/er/functions/calendar/shareplanneritems.aspx?categoryid=81";

/** Henter kirkens iCal uten CORS i utvikling (kun admin-synk, ikke visningsinnhold). */
function kirkeIcalPlugin(): Plugin {
  return {
    name: "kirke-ical-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || "").split("?")[0];
        if (pathOnly !== "/kirke-ical") {
          next();
          return;
        }
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 20000);
        fetch(KIRKE_ICAL_URL, { redirect: "follow", signal: ac.signal })
          .then(async (upstream) => {
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") || "text/calendar; charset=utf-8"
            );
            res.end(text);
          })
          .catch((err) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.end(String(err));
            }
          })
          .finally(() => clearTimeout(timer));
      });
    },
  };
}

/** Henter Apps Script med Node fetch (følger redirects). http-proxy timer ofte ut på Windows. */
function gasApiPlugin(gasUrl: string): Plugin {
  const targetBase = gasUrl.replace(/\/$/, '');
  return {
    name: 'gas-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/gas-api')) {
          next();
          return;
        }
        try {
          const incoming = new URL(url, 'http://localhost');
          const target = `${targetBase}${incoming.search}`;
          const method = (req.method || 'GET').toUpperCase();
          const headers: Record<string, string> = {};
          const contentType = req.headers['content-type'];
          if (contentType) headers['Content-Type'] = String(contentType);

          const init: RequestInit = {method, headers, redirect: 'follow'};
          if (method !== 'GET' && method !== 'HEAD') {
            init.body = await readBody(req);
          }

          const upstream = await fetch(target, init);
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') || 'application/json; charset=utf-8'
          );
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ok: false, error: String(err)}));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gasUrl = env.VITE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;

  return {
    plugins: [kirkeIcalPlugin(), gasApiPlugin(gasUrl), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
