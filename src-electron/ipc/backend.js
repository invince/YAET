const express = require("express");
const bodyParser = require("express");
const cors = require("cors");

function initBackend() {

  const expressApp = express(); // we define the express backend here, because maybe multiple module needs create custom backend
  expressApp.use(bodyParser.urlencoded({ extended: true })); // to accept application/x-www-form-urlencoded
  expressApp.use(express.json());
  expressApp.use(  cors({
    origin: 'http://localhost:4200', // Allow Angular dev server
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // If you need to send cookies or authentication
  }));

  return expressApp;
}


module.exports = { initBackend };
