const { TerminalRuntimeApi } = require('../../../src-electron/runtime/interfaces/terminalRuntimeApi');

class SerialSession extends TerminalRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this._initialConfig = config || null;
    this.port = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const { SerialPort } = require('serialport');
    const config = { ...this._initialConfig, ...options };

    if (!config.path) {
      throw new Error('Serial port path is required');
    }

    this.log.info(`Connecting to serial port: ${config.path} at ${config.baudRate || 9600} baud`);

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: config.path,
        baudRate: parseInt(config.baudRate, 10) || 9600,
        dataBits: parseInt(config.dataBits, 10) || 8,
        stopBits: parseFloat(config.stopBits) || 1,
        parity: config.parity || 'none',
        rtscts: !!config.rtscts,
        xon: !!config.xon,
        xoff: !!config.xoff,
        autoOpen: false
      });

      this.port.open((err) => {
        if (err) {
          this.log.error(`Failed to open serial port ${config.path}:`, err);
          return reject(err);
        }

        this._connected = true;
        this.log.info(`Serial port ${config.path} opened successfully`);

        this.port.on('data', (data) => {
          this.emit('output', { data: data.toString('utf-8') });
        });

        this.port.on('close', () => {
          this._connected = false;
          this.emit('disconnect', { error: null });
        });

        this.port.on('error', (portErr) => {
          this.log.error(`Serial port error on ${config.path}:`, portErr);
          this.emit('error', { error: portErr.message });
        });

        resolve();
      });
    });
  }

  async write(data) {
    if (!this.port || !this._connected) return false;
    return new Promise((resolve) => {
      this.port.write(data, (err) => {
        if (err) {
          this.log.error('Failed to write to serial port:', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async resize(cols, rows) {}

  async close() {
    if (this.port && this._connected) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.port = null;
          this._connected = false;
          resolve();
        });
      });
    }
  }
}

module.exports = { SerialSession };
