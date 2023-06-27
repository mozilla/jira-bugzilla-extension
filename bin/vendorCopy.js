#!/usr/bin/env node

import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Fix for __dirname not being available to es modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../');

const fileMapping = {
  'node_modules/lit-html/LICENSE': 'src/vendor/lit-html/LICENSE',
  'node_modules/lit-html/lit-html.js': 'src/vendor/lit-html/lit-html.js',
  'node_modules/lit-html/lit-html.js.map':
    'src/vendor/lit-html/lit-html.js.map',
};

for (const [key, value] of Object.entries(fileMapping)) {
  copyFile(path.join(projectRoot, key), path.join(projectRoot, value));
}
