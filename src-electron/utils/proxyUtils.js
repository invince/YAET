const { ProxyService } = require('../services/proxyService');

const _defaultService = new ProxyService({
  info: (msg) => { /* silent by default */ },
  warn: (msg) => { /* silent by default */ },
  error: (msg) => { /* silent by default */ }
});

function getProxyUrl(proxy, secretRepo, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.getProxyUrl(proxy, secretRepo);
}

async function createSOCKSConnection(proxy, targetHost, targetPort, secretRepo, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createSOCKSConnection(proxy, targetHost, targetPort, secretRepo);
}

async function createHTTPProxyConnection(proxy, targetHost, targetPort, secretRepo, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createHTTPProxyConnection(proxy, targetHost, targetPort, secretRepo);
}

async function createProxyConnection(proxy, targetHost, targetPort, secretRepo, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createProxyConnection(proxy, targetHost, targetPort, secretRepo);
}

module.exports = { getProxyUrl, createSOCKSConnection, createHTTPProxyConnection, createProxyConnection };
