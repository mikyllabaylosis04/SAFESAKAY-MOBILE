const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-router',
  'build',
  'fork',
  'useLinking.native.js',
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const needle =
  'onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));';
const replacement = `const path = (0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url);
                            queueMicrotask(() => {
                                onUnhandledLinking(path);
                            });`;

if (source.includes('queueMicrotask(() => {\n                                onUnhandledLinking(path);')) {
  process.exit(0);
}

if (!source.includes(needle)) {
  process.exit(0);
}

fs.writeFileSync(target, source.replace(needle, replacement));
