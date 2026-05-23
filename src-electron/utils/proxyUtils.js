const { ProxyService } = require('../services/proxyService');

const _defaultService = new ProxyService({
  info: (msg) => { /* silent by default */ },
  warn: (msg) => { /* silent by default */ },
  error: (msg) => { /* silent by default */ }
});

function getProxyUrl(proxy, getSecrets, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.getProxyUrl(proxy, getSecrets);
}

async function createSOCKSConnection(proxy, targetHost, targetPort, getSecrets, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createSOCKSConnection(proxy, targetHost, targetPort, getSecrets);
}

async function createHTTPProxyConnection(proxy, targetHost, targetPort, getSecrets, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createHTTPProxyConnection(proxy, targetHost, targetPort, getSecrets);
}

async function createProxyConnection(proxy, targetHost, targetPort, getSecrets, log) {
  const svc = log ? new ProxyService(log) : _defaultService;
  return svc.createProxyConnection(proxy, targetHost, targetPort, getSecrets);
}

module.exports = { getProxyUrl, createSOCKSConnection, createHTTPProxyConnection, createProxyConnection };
