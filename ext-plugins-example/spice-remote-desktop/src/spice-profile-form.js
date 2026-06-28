(function () {
  class SpiceProfileForm extends HTMLElement {
    constructor() {
      super();
      this._form = { host: '', port: 5900, tls: false };
      this._onChange = null;
    }

    connectedCallback() {
      this.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box';
      this.innerHTML = '' +
        '<label style="display:flex;flex-direction:column;gap:4px">' +
          '<span style="font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))">Host</span>' +
          '<input type="text" id="host" placeholder="hostname or IP" ' +
            'style="padding:8px 12px;border:1px solid var(--app-border-color,#444);border-radius:4px;background:transparent;color:var(--app-text-color,#fff);font:inherit;outline:none">' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px">' +
          '<span style="font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))">Port</span>' +
          '<input type="number" id="port" value="5900" ' +
            'style="padding:8px 12px;border:1px solid var(--app-border-color,#444);border-radius:4px;background:transparent;color:var(--app-text-color,#fff);font:inherit;outline:none">' +
        '</label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
          '<input type="checkbox" id="tls">' +
          '<span style="font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))">TLS Connection</span>' +
        '</label>';
      this._bindEvents();
      this._syncForm();
    }

    _bindEvents() {
      var self = this;
      this.querySelector('#host').addEventListener('input', function () { self._onInput(); });
      this.querySelector('#port').addEventListener('input', function () { self._onInput(); });
      this.querySelector('#tls').addEventListener('change', function () { self._onInput(); });
    }

    _onInput() {
      this._syncForm();
      this._notifyChange();
    }

    _syncForm() {
      var hostEl = this.querySelector('#host');
      var portEl = this.querySelector('#port');
      var tlsEl = this.querySelector('#tls');
      this._form.host = hostEl ? hostEl.value : '';
      this._form.port = portEl ? parseInt(portEl.value, 10) || 5900 : 5900;
      this._form.tls = tlsEl ? tlsEl.checked : false;
    }

    _notifyChange() {
      if (this._onChange) this._onChange(this.getForm());
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setForm(form) {
      this._form = form || { host: '', port: 5900, tls: false };
      var hostEl = this.querySelector('#host');
      var portEl = this.querySelector('#port');
      var tlsEl = this.querySelector('#tls');
      if (hostEl) hostEl.value = this._form.host || '';
      if (portEl) portEl.value = (this._form.port || 5900).toString();
      if (tlsEl) tlsEl.checked = !!this._form.tls;
    }

    setProfile(profile) {
      var data = profile ? profile.getProfile('SPICE_REMOTE_DESKTOP') : null;
      if (data) this.setForm(data);
    }

    getForm() {
      this._syncForm();
      return {
        host: this._form.host,
        port: this._form.port,
        tls: this._form.tls,
        authType: 'login',
        password: '',
      };
    }
  }

  customElements.define('spice-profile-form', SpiceProfileForm);
})();
