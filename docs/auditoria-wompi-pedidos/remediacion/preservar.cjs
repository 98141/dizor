// Preload: redirect generated historical evidence; assertions/source stay intact.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const out = path.join(__dirname, 'evidencias', process.env.REMEDIATION_RUN || 'actual');
const write = fs.writeFileSync;
fs.writeFileSync = function(file, ...args) {
  if (typeof file === 'string') {
    const absolute = path.resolve(file);
    if (absolute.startsWith(path.join(root, 'docs') + path.sep) && !absolute.startsWith(__dirname + path.sep)) {
      file = path.join(out, path.relative(root, absolute));
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
  }
  return write.call(this, file, ...args);
};
