// Karma config for YAET unit tests (ng test).
// Mirrors the built-in config from @angular-devkit/build-angular,
// plus a coverage gate via coverageReporter.check (karma-coverage).
const path = require('path');

module.exports = function (config) {
  const workspaceRoot = __dirname;
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-jasmine-html-reporter',
      'karma-coverage',
      '@angular-devkit/build-angular/plugins/karma',
    ].map((p) => require(p)),
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: path.join(workspaceRoot, 'coverage'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
      check: {
        global: { statements: 60, branches: 40, functions: 50, lines: 60 },
      },
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
