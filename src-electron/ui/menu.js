const { Menu } = require('electron');

function createMenu(log) {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };
