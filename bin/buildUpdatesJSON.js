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
  let manifest;
  try {
    const manifestData = await readFile(
      path.join(projectRoot, 'src/manifest.json'),
    );
    manifest = JSON.parse(manifestData);
  } catch (err) {
    console.error(err);
  }

  const repo = 'mozilla/jira-bugzilla-extension';
  const extName = manifest.name;
  const version = manifest.version;
  const id = manifest.browser_specific_settings.gecko.id;

  const updateData = {
    addons: {
      [id]: {
        updates: [
          {
            version,
            update_link: `https://github.com/${repo}/releases/download/v${version}/${extName}-v${version}.xpi`,
          },
        ],
      },
    },
  };

  try {
    await writeFile(
      path.join(projectRoot, 'updates.json'),
      JSON.stringify(updateData, null, 2),
    );
  } catch (err) {
    console.error(err);
  }
})();
