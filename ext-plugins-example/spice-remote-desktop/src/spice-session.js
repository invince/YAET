(function () {
  const SEND_CHANNEL = 'session.disconnect.rd.spice';
  const INVOKE_CHANNEL = 'session.open.rd.spice';
  const CONNECT_EVENT = 'session.connect.rd.spice';
  const DISCONNECT_EVENT = 'session.disconnect.rd.spice';
  const ERROR_EVENT = 'error';

  class SpiceSession extends HTMLElement {
    constructor() {
      super();
      this._spiceConn = null;
      this._sessionId = null;
      this._listeners = [];
    }

    setSession(session) {
      this._sessionId = session.id;
      const profile = session.profile.getProfile('SPICE_REMOTE_DESKTOP');
      if (!profile) {
        this._showError('No SPICE profile data found');
        return;
      }

      this._showConnecting();

      const api = window.electronAPI;
      api.invoke(INVOKE_CHANNEL, {
        id: this._sessionId,
        host: profile.host,
        port: profile.port || 5900,
        tls: !!profile.tls,
      }).then((websocketPort) => {
        this.innerHTML = '<div id="spice-screen" style="flex:1;width:100%;background:#000"></div>';
        var self = this;
        const spice = new SpiceMainConn({
          uri: 'ws://localhost:' + websocketPort,
          password: profile.password || undefined,
          screen_id: 'spice-screen',
          parent: this,
          onerror: function (err) {
            console.error('[spice-session] SPICE error:', err.message);
            self._showError('SPICE error: ' + (err.message || err));
          },
          onsuccess: function () {
            console.log('[spice-session] SPICE connected');
          },
        });
        this._spiceConn = spice;

        const onConnect = function () {
          console.log('[spice-session] Backend connected');
        };
        api.on(CONNECT_EVENT, onConnect);
        this._listeners.push(function () { api.removeAllListeners(CONNECT_EVENT); });
      }).catch(function (err) {
        console.error('[spice-session] Failed to open session:', err);
        this._showError('Connection failed: ' + (err.message || err));
      }.bind(this));

      const disconnectHandler = function (resp) {
        if (resp && resp.id === this._sessionId) {
          this._cleanup();
        }
      }.bind(this);
      api.on(DISCONNECT_EVENT, disconnectHandler);
      this._listeners.push(function () { api.removeAllListeners(DISCONNECT_EVENT); });

      const errorHandler = function (resp) {
        if (resp && resp.category === 'spice' && resp.id === this._sessionId) {
          console.error('[spice-session] Backend error:', resp.error);
          this._cleanup();
        }
      }.bind(this);
      api.on(ERROR_EVENT, errorHandler);
      this._listeners.push(function () { api.removeAllListeners(ERROR_EVENT); });
    }

    disconnect() {
      this._cleanup();
    }

    _showError(msg) {
      this.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:#1e1e1e';
      this.innerHTML = '<div style="color:#f44336;text-align:center;padding:24px;font-family:sans-serif">'
        + '<div style="font-size:18px;margin-bottom:8px">SPICE Connection Error</div>'
        + '<div style="font-size:13px;opacity:.8">' + msg + '</div>'
        + '</div>';
    }

    _showConnecting() {
      this.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:#1e1e1e';
      this.innerHTML = '<div style="color:#888;text-align:center;padding:24px;font-family:sans-serif">'
        + '<div style="font-size:16px;margin-bottom:8px">Connecting to SPICE...</div>'
        + '</div>';
    }

    _cleanup() {
      if (this._spiceConn) {
        try { this._spiceConn.stop(); } catch (e) {}
        try { this._spiceConn.cleanup(); } catch (e) {}
        this._spiceConn = null;
      }
      if (this._sessionId) {
        try { window.electronAPI.send(SEND_CHANNEL, { id: this._sessionId }); } catch (e) {}
        this._sessionId = null;
      }
      for (var i = 0; i < this._listeners.length; i++) {
        try { this._listeners[i](); } catch (e) {}
      }
      this._listeners = [];
    }
  }

  customElements.define('spice-session', SpiceSession);
})();
