const {ipcMain, session} = require('electron');

function initProxy(log) {

  ipcMain.on('proxy.set', async (event, {proxyUrl, noProxy, login, password}) => {
    if (proxyUrl) {
      if (login && password) {
        let loginU = encodeURIComponent(login);
        let passU = encodeURIComponent(password);
        proxyUrl = proxyUrl.replace('https://', `https://${loginU}:${passU}@`);
        proxyUrl = proxyUrl.replace('http://', `http://${loginU}:${passU}@`);
      }

      var config = {};
      config.proxyRules = proxyUrl;
      if (noProxy) {
        config.proxyBypassRules = noProxy;
      }

      session.defaultSession.setProxy({
        config
      }).then(() => {
        log.info('Proxy set');
      }).catch(err => {
        log.error('Failed to set proxy:', err);
      });


    } else {
      session.defaultSession.setProxy({
        proxyRules: ''
      }).then(() => {
        log.info('Proxy unset successfully');
      }).catch(err => {
        log.error('Failed to unset proxy:', err);
      });
    }
  });

}

module.exports = {initProxy};
