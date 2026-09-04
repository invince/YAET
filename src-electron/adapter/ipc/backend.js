const express = require("express");
const bodyParser = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { ipcMain } = require("electron");

const API_TOKEN = crypto.randomUUID();

function initBackend(log) {

  log.info("Creating backend...");
  const expressApp = express();
  expressApp.use(bodyParser.urlencoded({ extended: true }));
  expressApp.use(express.json());
  // P0-S1: the renderer runs at file:// (prod) or localhost:4200 (dev).
  // Anything else presenting an Origin is not us. The per-launch random
  // token (IPC-only) remains the real gate; this is defense in depth.
  const ALLOWED_ORIGINS = new Set(['http://localhost:4200', 'http://127.0.0.1:4200', 'null']);
  expressApp.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.has(origin)) cb(null, true);
      else cb(new Error('CORS origin blocked'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token'],
    credentials: true,
  }));

  // P0-S1+S2: real gate. Loopback-only (belt: listen binds 127.0.0.1 too),
  // then per-launch token with constant-time compare. OPTIONS preflight
  // carries no headers by design — let it through to cors().
  const LOOPBACKS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  expressApp.use('/api', (req, res, next) => {
    const remote = req.socket.remoteAddress || '';
    if (!LOOPBACKS.has(remote)) {
      log.warn(`Non-loopback API request blocked: ${remote} ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.method === 'OPTIONS') return next();
    const token = req.headers['x-api-token'];
    const expected = Buffer.from(API_TOKEN);
    const actual = typeof token === 'string' ? Buffer.from(token) : Buffer.alloc(0);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      log.warn(`API request missing or invalid token: ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });

  // IPC handler so renderer can retrieve the token
  ipcMain.handle('get-api-token', () => API_TOKEN);

  log.info("Backend started");
  expressApp.authToken = API_TOKEN;
  return expressApp;
}


module.exports = { initBackend };


module.exports = { initBackend };
