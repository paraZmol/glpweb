// Preloaded (NODE_OPTIONS=--require) into every Node process started by scripts/emulators.mjs.
// On Windows a console program launched without `windowsHide` can open its own console window,
// which steals the keyboard focus from whatever the person at the machine is doing. Neither npm,
// the Firebase CLI nor Vitest pass that option, so it is forced here for the whole process tree.
'use strict';

if (process.platform === 'win32') {
  const childProcess = require('node:child_process');
  const { syncBuiltinESMExports } = require('node:module');

  const isOptions = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  const hidden = (original) =>
    function patched(...args) {
      const index = args.findIndex(isOptions);
      if (index === -1) {
        const callback = typeof args.at(-1) === 'function' ? args.pop() : undefined;
        args.push({ windowsHide: true });
        if (callback) args.push(callback);
      } else {
        args[index] = { ...args[index], windowsHide: true };
      }
      return original.apply(this, args);
    };

  for (const name of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]) {
    childProcess[name] = hidden(childProcess[name]);
  }
  syncBuiltinESMExports();
}
