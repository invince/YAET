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
  expressApp.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token'],
    credentials: true,
  }));

  // Auth middleware: require x-api-token header for all /api/ routes
  expressApp.use('/api', (req, res, next) => {
    const token = req.headers['x-api-token'];
    if (!token || token !== API_TOKEN) {
      log.warn(`API request missing or invalid token: ${req.method} ${req.path}`);
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
