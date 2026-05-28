const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: 'Too many requests, please try again later.' } },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: 'Too many upload requests, please try again later.' } },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: 'Too many download requests, please try again later.' } },
});

const openLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: 'Too many open requests, please try again later.' } },
});

module.exports = { generalLimiter, uploadLimiter, downloadLimiter, openLimiter };
