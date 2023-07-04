#!/usr/bin/env node

import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import confirm from '@inquirer/confirm';
import select from '@inquirer/select';
import { inc } from 'semver';

import { main as buildUpdatesJSON } from './buildUpdatesJSON.js';

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

  const currentVersion = manifestData.version;

  const next = {
    patch: inc(currentVersion, 'patch'),
    minor: inc(currentVersion, 'minor'),
    major: inc(currentVersion, 'major'),
  };

  const answer = await select({
    message: `Select a semver release bump:`,
    choices: [
      {
        name: 'PATCH',
        value: 'patch',
        description: `A patch release, current: ${currentVersion} new: ${next.patch}`,
      },
      {
        name: 'MINOR',
        value: 'minor',
        description: `A minor release, current: ${currentVersion} new: ${next.minor}`,
      },
      {
        name: 'MAJOR',
        value: 'major',
        description: `A major release, current: ${currentVersion} new: ${next.major}`,
      },
    ],
  });

  const newManifestData = { ...manifestData };
  const newVersion = (newManifestData.version = next[answer]);

  try {
    await writeFile(
      path.join(projectRoot, 'src/manifest.json'),
      JSON.stringify(newManifestData, null, 2),
    );
    console.log(`Writing new version ${newVersion} to src/manifest.json`);
  } catch (err) {
    console.error(err);
  }

  try {
    await buildUpdatesJSON();
    console.log(`Updating updates.json for ${newVersion}`);
  } catch (err) {
    console.error(err);
  }

  const message = `Version bumped to: ${newVersion} 😎. Check the diff and commit, and then tag and push the tag with:

  git tag v${newVersion}
  git push upstream --tags`;

  console.log(message);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
