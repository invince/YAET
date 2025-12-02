/**
 * Utility functions for proxy configuration
 */

/**
 * Generates a proxy URL with optional authentication from secrets
 * @param {Object} proxy - The proxy object containing host, port, and optional secretId
 * @param {Function} getSecrets - Function to retrieve secrets
 * @param {Object} log - Logger instance
 * @returns {string|null} The proxy URL (e.g., "http://user:pass@host:port") or null if proxy is invalid
 */
function getProxyUrl(proxy, getSecrets, log) {
    if (!proxy) {
        return null;
    }

    let proxyUrl = '';

    // Check if proxy has a secretId for authentication
    if (proxy.secretId) {
        const secrets = getSecrets();
        if (secrets && secrets.secrets) {
            const secret = secrets.secrets.find(s => s.id === proxy.secretId);
            if (secret && secret.login && secret.password) {
                // Include authentication in proxy URL
                const username = encodeURIComponent(secret.login);
                const password = encodeURIComponent(secret.password);
                proxyUrl = `http://${username}:${password}@${proxy.host}:${proxy.port}`;
                return proxyUrl;
            } else {
                if (log) {
                    log.warn(`Secret found for proxy but missing login/password credentials`);
                }
            }
        } else {
            if (log) {
                log.warn(`Proxy has secretId but secrets not available`);
            }
        }
    }

    // No authentication or secret not found, use basic proxy URL
    return `http://${proxy.host}:${proxy.port}`;
}

module.exports = { getProxyUrl };
