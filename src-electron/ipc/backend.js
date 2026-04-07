const express = require("express");
const bodyParser = require("express");
const cors = require("cors");
const log = require("electron-log");

function initBackend(log, bearerToken) {

  log.info("Creating backend...");
  const expressApp = express(); // we define the express backend here, because maybe multiple module needs create custom backend
  expressApp.use(bodyParser.urlencoded({ extended: true })); // to accept application/x-www-form-urlencoded
  expressApp.use(express.json());
  expressApp.use(  cors({
    origin: ['http://localhost:4200', 'file://'], // Allow Angular dev server and production file
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // If you need to send cookies or authentication
  }));

  // Bearer token middleware — protects all /api routes
  expressApp.use('/api', (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${bearerToken}`) {
      log.warn(`Unauthorized request to ${req.path} from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  log.info("Backend started");
  return expressApp;
}


module.exports = { initBackend };
