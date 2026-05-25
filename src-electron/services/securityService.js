const keytar = require("keytar");
const CryptoJS = require("crypto-js");

const service = 'io.github.invince.YAET';
const account = 'ac13ba1ac2f841d19a9f73bd8c335086';

class SecurityService {
  constructor(log) {
    this.log = log;
  }

  async save(password) {
    await keytar.setPassword(service, account, password);
  }

  async get() {
    return keytar.getPassword(service, account);
  }

  async delete() {
    await keytar.deletePassword(service, account);
  }

  async decrypt(data) {
    return decrypt(data);
  }
}

async function decrypt(data) {
  const password = await keytar.getPassword(service, account);
  if (!password) {
    throw new Error('Master key not found');
  }
  const bytes = CryptoJS.AES.decrypt(data, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { SecurityService, decrypt };
