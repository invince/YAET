class S3ProfileForm extends HTMLElement {
  constructor() {
    super();
    this._form = {};
    this._onChange = null;
  }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;padding-right:4px;flex-shrink:0';

    const inputStyle = 'padding:8px 12px;width:100%;box-sizing:border-box;border:1px solid var(--app-border-color,#444);border-radius:4px;background:transparent;color:var(--app-text-color,#fff);font:inherit;outline:none;transition:border-color .2s';
    const focusAttr = `onfocus="this.style.borderColor='var(--app-accent-color,#7c4dff)'"`;
    const blurAttr = `onblur="this.style.borderColor='var(--app-border-color,#444)'"`;
    const labelStyle = 'display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box';
    const spanStyle = 'font-size:12px;color:var(--app-text-secondary,rgba(255,255,255,.7))';

    this.innerHTML = `
      <label style="${labelStyle}">
        <span style="${spanStyle}">Region</span>
        <input type="text" id="region" placeholder="us-east-1" value="${this._form.region || 'us-east-1'}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>

      <label style="${labelStyle}">
        <span style="${spanStyle}">Bucket</span>
        <input type="text" id="bucket" placeholder="my-bucket" value="${this._form.bucket || ''}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>

      <label style="${labelStyle}">
        <span style="${spanStyle}">Endpoint (for S3-compatible services)</span>
        <input type="url" id="endpoint" placeholder="http://localhost:9000" value="${this._form.endpoint || ''}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>

      <label style="display:flex;flex-direction:row;align-items:center;gap:8px;width:100%;box-sizing:border-box;cursor:pointer">
        <input type="checkbox" id="forcePathStyle" ${this._form.forcePathStyle !== false ? 'checked' : ''}
          style="width:16px;height:16px;accent-color:var(--app-accent-color,#7c4dff);cursor:pointer">
        <span style="font-size:13px;color:var(--app-text-secondary,rgba(255,255,255,.7))">Force Path Style (required for MinIO)</span>
      </label>

      <label style="${labelStyle}">
        <span style="${spanStyle}">Max File Size for Open/Download (MB)</span>
        <input type="number" id="maxFileSize" min="1" max="1000" value="${this._form.maxFileSize || 100}"
          style="${inputStyle}" ${focusAttr} ${blurAttr}>
      </label>
    `;

    // Bind events
    const ids = ['region', 'bucket', 'endpoint', 'maxFileSize'];
    for (const id of ids) {
      const el = this.querySelector('#' + id);
      if (el) el.addEventListener('input', () => this._onInput());
    }
    const checkbox = this.querySelector('#forcePathStyle');
    if (checkbox) checkbox.addEventListener('change', () => this._onInput());
  }

  _onInput() {
    this._notifyChange();
  }

  _notifyChange() {
    if (this._onChange) this._onChange(this.getForm());
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  setForm(form) {
    this._form = form || {};
    const fields = ['region', 'bucket', 'endpoint', 'maxFileSize'];
    for (const id of fields) {
      const el = this.querySelector('#' + id);
      if (el) el.value = this._form[id] || '';
    }
    const checkbox = this.querySelector('#forcePathStyle');
    if (checkbox) checkbox.checked = this._form.forcePathStyle !== false;
  }

  setProfile(profile) {
    const data = profile?.getProfile?.('S3_FILE_EXPLORER');
    if (data) this.setForm(data);
  }

  getForm() {
    return {
      region: (this.querySelector('#region')?.value || '').trim(),
      bucket: (this.querySelector('#bucket')?.value || '').trim(),
      endpoint: (this.querySelector('#endpoint')?.value || '').trim(),
      forcePathStyle: this.querySelector('#forcePathStyle')?.checked !== false,
      maxFileSize: parseInt(this.querySelector('#maxFileSize')?.value, 10) || 100,
    };
  }
}

customElements.define('s3-profile-form', S3ProfileForm);

window.__S3_FILE_EXPLORER_PLUGIN__ = {
  manifest: {
    id: 's3-file-explorer',
    name: 'S3 File Explorer',
    category: 'FILE_EXPLORER',
    profileType: 'S3_FILE_EXPLORER',
    supportedAuthTypes: ['login', 'secret'],
    secretTypes: ['LOGIN_PASSWORD'],
  },
  profileFormElement: 's3-profile-form',
};
