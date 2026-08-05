class DockerProfileForm extends HTMLElement {
  constructor() {
    super();
    this._form = {};
    this._onChange = null;
    this._containers = [];
  }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;padding-right:4px;flex-shrink:0';

    const inputStyle = 'padding:8px 12px;width:100%;box-sizing:border-box;border:1px solid var(--app-border-color,#444);border-radius:4px;background:transparent;color:var(--app-text-color,#fff);font:inherit;outline:none;transition:border-color .2s';
    const focusAttr = `onfocus="this.style.borderColor='var(--app-accent-color,#7c4dff)'"`;
    const blurAttr = `onblur="this.style.borderColor='var(--app-border-color,#444)'"`;
    const labelStyle = 'display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box';
    const spanStyle = 'font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))';
    const rowStyle = 'display:flex;flex-direction:row;gap:8px;width:100%;box-sizing:border-box';
    const btnStyle = 'padding:8px 16px;border:1px solid var(--app-border-color,#444);border-radius:4px;background:var(--app-accent-color,#7c4dff);color:#fff;cursor:pointer;font:inherit;white-space:nowrap;transition:opacity .2s';

    const defaultSocket = navigator.platform.includes('Win')
      ? '//./pipe/docker_engine'
      : '/var/run/docker.sock';

    this.innerHTML = `
      <label style="${labelStyle}">
        <span style="${spanStyle}">Docker Socket Path</span>
        <input type="text" id="socketPath" placeholder="${defaultSocket}" value="${this._form.socketPath || ''}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>

      <div style="${rowStyle}">
        <label style="${labelStyle}">
          <span style="${spanStyle}">Host (TCP)</span>
          <input type="text" id="host" placeholder="localhost" value="${this._form.host || ''}"
            style="${inputStyle}" ${focusAttr} ${blurAttr}>
        </label>
        <label style="${labelStyle}">
          <span style="${spanStyle}">Port</span>
          <input type="number" id="port" placeholder="2375" value="${this._form.port || ''}"
            style="${inputStyle}" ${focusAttr} ${blurAttr}>
        </label>
      </div>

      <div style="${rowStyle}">
        <label style="${labelStyle}">
          <span style="${spanStyle}">Container ID or Name <span style="color:#f44336">*</span></span>
          <input type="text" id="container" placeholder="my-container" value="${this._form.container || ''}"
            required style="${inputStyle}" ${focusAttr} ${blurAttr}>
        </label>
        <button id="listContainers" style="${btnStyle};align-self:flex-end" title="List Running Containers">Refresh</button>
      </div>

      <div id="containerList" style="display:none;max-height:150px;overflow-y:auto;border:1px solid var(--app-border-color,#444);border-radius:4px;padding:4px;box-sizing:border-box"></div>

      <label style="${labelStyle}">
        <span style="${spanStyle}">Exec Command</span>
        <input type="text" id="command" placeholder="/bin/bash" value="${this._form.command || '/bin/bash'}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>
    `;

    const ids = ['socketPath', 'host', 'port', 'container', 'command'];
    for (const id of ids) {
      const el = this.querySelector('#' + id);
      if (el) el.addEventListener('input', () => this._onInput());
    }

    this.querySelector('#listContainers').addEventListener('click', () => this._listContainers());
  }

  async _listContainers() {
    const btn = this.querySelector('#listContainers');
    const containerList = this.querySelector('#containerList');
    try {
      btn.textContent = 'Loading...';
      btn.disabled = true;
      const containers = await window.electronAPI.invoke('docker.list-containers');
      this._containers = containers || [];
      containerList.style.display = this._containers.length > 0 ? 'block' : 'none';
      containerList.innerHTML = '';
      for (const c of this._containers) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:6px 8px;cursor:pointer;border-radius:3px;font-size:13px;color:var(--app-text-color,#fff);transition:background .15s';
        const name = c.names.length > 0 ? c.names[0] : c.id;
        item.textContent = `${name}  (${c.image}) — ${c.status || c.state}`;
        if (c.state === 'running') {
          item.style.borderLeft = '3px solid #4caf50';
          item.style.paddingLeft = '5px';
        }
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--app-hover-bg,rgba(255,255,255,.08))'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
        item.addEventListener('click', () => {
          this.querySelector('#container').value = name;
          this._onInput();
          containerList.style.display = 'none';
        });
        containerList.appendChild(item);
      }
      btn.textContent = 'Refresh';
      btn.disabled = false;
    } catch (err) {
      containerList.style.display = 'block';
      containerList.innerHTML = `<div style="padding:8px;color:#f44336;font-size:13px">Failed to list containers: ${err.message}</div>`;
      btn.textContent = 'Refresh';
      btn.disabled = false;
    }
  }

  _onInput() {
    this._validateContainer();
    this._notifyChange();
  }

  _notifyChange() {
    if (this._onChange) this._onChange(this.getForm());
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  _validateContainer() {
    const containerEl = this.querySelector('#container');
    if (!containerEl) return;
    const container = (containerEl.value || '').trim();
    if (!container) {
      containerEl.style.borderColor = '#f44336';
    } else {
      containerEl.style.borderColor = 'var(--app-border-color,#444)';
    }
  }

  setForm(form) {
    this._form = form || {};
    const fields = ['socketPath', 'host', 'port', 'container', 'command'];
    for (const id of fields) {
      const el = this.querySelector('#' + id);
      if (el) el.value = this._form[id] || '';
    }
  }

  setProfile(profile) {
    const data = profile?.getProfile?.('DOCKER_TERMINAL');
    if (data) this.setForm(data);
  }

  getForm() {
    const container = (this.querySelector('#container')?.value || '').trim();
    return {
      socketPath: (this.querySelector('#socketPath')?.value || '').trim(),
      host: (this.querySelector('#host')?.value || '').trim(),
      port: (this.querySelector('#port')?.value || '').trim(),
      container,
      command: (this.querySelector('#command')?.value || '/bin/bash').trim(),
      valid: container.length > 0,
    };
  }
}

customElements.define('docker-profile-form', DockerProfileForm);

window.__DOCKER_TERMINAL_PLUGIN__ = {
  manifest: {
    id: 'docker-terminal',
    name: 'Docker Exec Terminal',
    category: 'TERMINAL',
    profileType: 'DOCKER_TERMINAL',
    supportedAuthTypes: ['N/A'],
    secretTypes: [],
  },
  profileFormElement: 'docker-profile-form',
};
