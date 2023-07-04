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

export async function main() {
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
      gecko: { id, strict_min_version },
    },
    name,
    version,
  } = manifestData;

  if (!oldUpdateData) {
    oldUpdateData = {
      addons: {
        [id]: {
          updates: [],
        },
      },
    };
  }

  const oldUpdates = oldUpdateData.addons[id].updates;
  const filteredUpdates = oldUpdates.filter(
    (update) => update.version !== version,
  );

  if (oldUpdates.length !== filteredUpdates.length) {
    console.log('Version already exists in updates.json');
  }

  const newVersion = {
    version,
    update_link: `https://github.com/${repo}/releases/download/v${version}/${name}-v${version}.xpi`,
  };

  if (strict_min_version) {
    newVersion.applications = {
      gecko: {
        strict_min_version,
      },
    };
  }

  const newUpdateData = {
    addons: {
      [id]: {
        updates: [newVersion, ...filteredUpdates],
      },
    },
  };

  try {
    await writeFile(
      path.join(projectRoot, 'updates.json'),
      JSON.stringify(newUpdateData, null, 2),
    );
  } catch (err) {
    console.error(err);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
