// Minimal Express proxy to PipeRun to bypass CORS and hide credentials
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// CORS: allow local dev servers (127.0.0.1 and localhost on common ports)
const allowedOrigins = new Set([
  'http://127.0.0.1:5501',
  'http://localhost:5501',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow tools and curl
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(null, true); // permissive for dev
  },
}));

app.use(express.json());

// Config from env with sensible defaults (provided by user)
const PIPE_RUN_TOKEN = process.env.PIPERUN_TOKEN || '6cc7a96c25ac9a34a84d4219e23aab20';
const PIPE_RUN_FUNNEL_ID = process.env.PIPERUN_FUNNEL_ID || '45772';
const PIPE_RUN_STAGE_ID = process.env.PIPERUN_STAGE_ID || '262331';

// Known base URLs and endpoints to try (order matters)
const BASE_URLS = [
  'https://app.pipe.run/webservice/integracao',
  'https://app.piperun.com/webservice/integracao',
  'https://api.piperun.com/v1',
  'https://api.piperun.app/v1',
  'https://piperun.app/webservice/integracao',
  'https://app.piperun.app/webservice/integracao',
];

const PEOPLE_ENDPOINTS = ['/pessoas', '/pessoa', '/leads', '/contatos'];
const DEALS_ENDPOINTS = ['/negociospororganizacao', '/negocios', '/deals', '/oportunidades'];

function toBRDate(iso) {
  // iso: YYYY-MM-DD -> DD/MM/YYYY
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function tryAxiosGet(url, params) {
  try {
    const res = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'relatorio-pre-vendas-proxy/1.0',
      },
      validateStatus: () => true, // we’ll inspect status manually
    });
    return res;
  } catch (err) {
    return { status: 0, error: err };
  }
}

async function discoverBaseAndEndpoint(endpoints, params) {
  for (const base of BASE_URLS) {
    for (const ep of endpoints) {
      const url = `${base}${ep}`;
      const res = await tryAxiosGet(url, params);
      if (res.status === 200 && res.data) {
        return { base, endpoint: ep, data: res.data };
      }
      // Some APIs return 401 for missing token but indicate correct path
      if (res.status === 401) {
        return { base, endpoint: ep, data: null };
      }
    }
  }
  return null;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Simple connectivity test against /pessoas with limit=1
app.get('/api/piperun/test', async (req, res) => {
  const params = { token: PIPE_RUN_TOKEN, limite: 1 };
  const found = await discoverBaseAndEndpoint(PEOPLE_ENDPOINTS, params);
  if (!found) return res.status(502).json({ ok: false, error: 'No reachable PipeRun base/endpoint' });
  res.json({ ok: true, base: found.base, endpoint: found.endpoint, sample: found.data });
});

// Pessoas/Leads for a given date (YYYY-MM-DD)
app.get('/api/piperun/pessoas', async (req, res) => {
  try {
    const dateISO = req.query.date || req.query.data || new Date().toISOString().slice(0, 10);
    const startBR = req.query.data_inicio || toBRDate(dateISO);
    const endBR = req.query.data_fim || toBRDate(dateISO);

    const params = { token: PIPE_RUN_TOKEN, data_inicio: startBR, data_fim: endBR };
    let lastErr;
    for (const base of BASE_URLS) {
      for (const ep of PEOPLE_ENDPOINTS) {
        const url = `${base}${ep}`;
        const resp = await tryAxiosGet(url, params);
        if (resp.status === 200 && resp.data) {
          return res.json(resp.data);
        }
        lastErr = { status: resp.status, data: resp.data, url };
      }
    }
    return res.status(502).json({ error: 'Failed to fetch PipeRun pessoas', lastErr });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching pessoas', detail: err.message });
  }
});

// Deals in a given funnel/stage (MQL)
app.get('/api/piperun/mql', async (req, res) => {
  try {
    const funnelId = String(req.query.funnelId || PIPE_RUN_FUNNEL_ID);
    const stageId = String(req.query.stageId || PIPE_RUN_STAGE_ID);
    const params = { token: PIPE_RUN_TOKEN, id_funil: funnelId, id_etapa: stageId };
    let lastErr;
    for (const base of BASE_URLS) {
      for (const ep of DEALS_ENDPOINTS) {
        const url = `${base}${ep}`;
        const resp = await tryAxiosGet(url, params);
        if (resp.status === 200 && resp.data) {
          return res.json(resp.data);
        }
        lastErr = { status: resp.status, data: resp.data, url };
      }
    }
    return res.status(502).json({ error: 'Failed to fetch PipeRun deals', lastErr });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching deals', detail: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
});
