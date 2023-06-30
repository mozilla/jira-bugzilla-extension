#!/usr/bin/env node

/*
 * Helper script that builds an update file based on the manifest.json.
 */

import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Fix for __dirname not being available to es modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../');

(async function main() {
  let manifestData;
  try {
    const manifest = await readFile(
      path.join(projectRoot, 'src/manifest.json'),
    );
    manifestData = JSON.parse(manifest);
  } catch (err) {
    console.error(err);
  }

  let oldUpdateData;
  try {
    const updateData = await readFile(path.join(projectRoot, 'updates.json'));
    oldUpdateData = JSON.parse(updateData);
  } catch (err) {
    console.error(err);
  }

  const repo = 'mozilla/jira-bugzilla-extension';
  const {
    browser_specific_settings: {
      gecko: { id },
    },
    version,
  } = manifestData;

  const oldUpdates = oldUpdateData.addons[id].updates;
  const filteredUpdates = oldUpdates.filter(
    (update) => update.version === version,
  );

  if (filteredUpdates.length === 0) {
    console.error(
      'The current manifest version is not found in updates.json 🚨',
    );
    process.exit(1);
  } else {
    console.log('The current manifest has an update in updates.json 😎');
  }
})();
