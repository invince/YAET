/**
 * Utility functions for proxy configuration
 */

const { SocksClient } = require('socks');
const net = require('net');

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

/**
 * Creates a SOCKS proxy connection to a target host
 * @param {Object} proxy - The proxy object containing host, port, type, and optional secretId
 * @param {string} targetHost - The target host to connect to
 * @param {number} targetPort - The target port to connect to
 * @param {Function} getSecrets - Function to retrieve secrets
 * @param {Object} log - Logger instance
 * @returns {Promise<Socket>} A promise that resolves to the connected socket
 */
async function createSOCKSConnection(proxy, targetHost, targetPort, getSecrets, log) {
    if (!proxy) {
        throw new Error('Proxy configuration is required');
    }

    // Determine SOCKS version from proxy type
    let socksVersion = 5; // Default to SOCKS5
    if (proxy.type === 'SOCKS4') {
        socksVersion = 4;
    }

    // Build SOCKS client options
    const options = {
        proxy: {
            host: proxy.host,
            port: proxy.port,
            type: socksVersion
        },
        command: 'connect',
        destination: {
            host: targetHost,
            port: targetPort
        }
    };

    // Add authentication if proxy has a secret
    if (proxy.secretId) {
        const secrets = getSecrets();
        if (secrets && secrets.secrets) {
            const secret = secrets.secrets.find(s => s.id === proxy.secretId);
            if (secret && secret.login && secret.password) {
                options.proxy.userId = secret.login;
                options.proxy.password = secret.password;
                if (log) {
                    log.info(`Using authenticated SOCKS${socksVersion} proxy: ${proxy.host}:${proxy.port}`);
                }
            } else {
                if (log) {
                    log.warn(`Proxy has secretId but secret not found or incomplete`);
                }
            }
        }
    } else {
        if (log) {
            log.info(`Using SOCKS${socksVersion} proxy: ${proxy.host}:${proxy.port}`);
        }
    }

    try {
        const info = await SocksClient.createConnection(options);
        return info.socket;
    } catch (error) {
        if (log) {
            log.error(`Failed to create SOCKS connection: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Creates an HTTP CONNECT tunnel through an HTTP proxy
 * @param {Object} proxy - The proxy object containing host, port, and optional secretId
 * @param {string} targetHost - The target host to connect to
 * @param {number} targetPort - The target port to connect to
 * @param {Function} getSecrets - Function to retrieve secrets
 * @param {Object} log - Logger instance
 * @param {Promise<Socket>} A promise that resolves to the connected socket
 */
async function createHTTPProxyConnection(proxy, targetHost, targetPort, getSecrets, log) {
    return new Promise((resolve, reject) => {
        const proxySocket = net.connect(proxy.port, proxy.host, () => {
            if (log) {
                log.info(`Connected to HTTP proxy: ${proxy.host}:${proxy.port}`);
            }

            // Build CONNECT request
            let authHeader = '';
            if (proxy.secretId) {
                const secrets = getSecrets();
                if (secrets && secrets.secrets) {
                    const secret = secrets.secrets.find(s => s.id === proxy.secretId);
                    if (secret && secret.login && secret.password) {
                        const credentials = Buffer.from(`${secret.login}:${secret.password}`).toString('base64');
                        authHeader = `Proxy-Authorization: Basic ${credentials}\r\n`;
                        if (log) {
                            log.info(`Using authenticated HTTP proxy`);
                        }
                    }
                }
            }

            const connectRequest =
                `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
                `Host: ${targetHost}:${targetPort}\r\n` +
                authHeader +
                `\r\n`;

            proxySocket.write(connectRequest);

            // Wait for CONNECT response
            let responseData = '';
            const onData = (data) => {
                responseData += data.toString();

                // Check if we have the complete response header
                if (responseData.includes('\r\n\r\n')) {
                    proxySocket.removeListener('data', onData);

                    const statusLine = responseData.split('\r\n')[0];
                    const statusCode = parseInt(statusLine.split(' ')[1]);

                    if (statusCode === 200) {
                        if (log) {
                            log.info(`HTTP CONNECT tunnel established to ${targetHost}:${targetPort}`);
                        }
                        resolve(proxySocket);
                    } else {
                        proxySocket.destroy();
                        if (log) {
                            log.error(`HTTP proxy CONNECT failed. Status: ${statusCode}`);
                            log.error(`Full response:\n${responseData}`);
                        }
                        reject(new Error(`HTTP proxy CONNECT failed with status ${statusCode}: ${statusLine}`));
                    }
                }
            };

            proxySocket.on('data', onData);
        });

        proxySocket.on('error', (err) => {
            if (log) {
                log.error(`HTTP proxy connection error: ${err.message}`);
            }
            reject(err);
        });

        proxySocket.on('timeout', () => {
            proxySocket.destroy();
            reject(new Error('HTTP proxy connection timeout'));
        });

        proxySocket.setTimeout(30000); // 30 second timeout
    });
}

/**
 * Creates a proxy connection (HTTP or SOCKS) based on proxy type
 * @param {Object} proxy - The proxy object containing host, port, type, and optional secretId
 * @param {string} targetHost - The target host to connect to
 * @param {number} targetPort - The target port to connect to
 * @param {Function} getSecrets - Function to retrieve secrets
 * @param {Object} log - Logger instance
 * @returns {Promise<Socket>} A promise that resolves to the connected socket
 */
async function createProxyConnection(proxy, targetHost, targetPort, getSecrets, log) {
    if (!proxy) {
        throw new Error('Proxy configuration is required');
    }

    // Determine proxy type and create appropriate connection
    if (proxy.type === 'HTTP') {
        return await createHTTPProxyConnection(proxy, targetHost, targetPort, getSecrets, log);
    } else if (proxy.type === 'SOCKS4' || proxy.type === 'SOCKS5') {
        return await createSOCKSConnection(proxy, targetHost, targetPort, getSecrets, log);
    } else {
        throw new Error(`Unsupported proxy type: ${proxy.type}`);
    }
}

module.exports = { getProxyUrl, createSOCKSConnection, createHTTPProxyConnection, createProxyConnection };
