class WebDavProfileForm extends HTMLElement {
  constructor() {
    super();
    this._form = {};
    this._onChange = null;
  }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box';
    this.innerHTML = `
      <label style="display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box">
        <span style="font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))">WebDAV URL</span>
        <input type="url" id="url" placeholder="https://example.com/remote.php/dav/files/user/"
          style="padding:8px 12px;width:100%;box-sizing:border-box;border:1px solid var(--app-border-color,#444);border-radius:4px;background:transparent;color:var(--app-text-color,#fff);font:inherit;outline:none;transition:border-color .2s"
          onfocus="this.style.borderColor='var(--app-accent-color,#7c4dff)'"
          onblur="this.style.borderColor='var(--app-border-color,#444)'">
      </label>
    `;
    const urlEl = this.querySelector('#url');
    if (urlEl) urlEl.addEventListener('input', () => this._onInput());
    if (urlEl) urlEl.value = this._form?.url || '';
  }

  _onInput() {
    this._notifyChange();
  }

  _notifyChange() {
    if (this._onChange) this._onChange(this.getForm());
    this.dispatchEvent(new Event('change', {bubbles: true}));
  }

  setForm(form) {
    this._form = form || {};
    const url = (this._form.url || '').replace(/^(https?:\/\/)https?:\/\//, '$1');
    const urlEl = this.querySelector('#url');
    if (urlEl) urlEl.value = url;
  }

  setProfile(profile) {
    const data = profile?.getProfile?.('WEBDAV_FILE_EXPLORER');
    if (data) this.setForm(data);
  }

  getForm() {
    const urlEl = this.querySelector('#url');
    const raw = urlEl?.value || '';
    return { url: raw.replace(/^(https?:\/\/)https?:\/\//, '$1') };
  }
}

customElements.define('webdav-profile-form', WebDavProfileForm);

window.__WEBDAV_FILE_EXPLORER_PLUGIN__ = {
  manifest: {
    id: 'webdav-file-explorer',
    name: 'WebDAV File Explorer',
    category: 'FILE_EXPLORER',
    profileType: 'WEBDAV_FILE_EXPLORER',
    supportedAuthTypes: ['N/A', 'login', 'secret'],
    secretTypes: ['LOGIN_PASSWORD', 'PASSWORD_ONLY'],
  },
  profileFormElement: 'webdav-profile-form',
};
