#!/usr/bin/env node
import { loadConfig } from '../lib/config.mjs';
import { packageApp } from '../lib/package.mjs';
import { prepareAssets } from '../lib/prepare.mjs';
import { release } from '../lib/release.mjs';

const usage = `Usage:
  electron-mac-release prepare            Copy configured app assets
  electron-mac-release package [--sign]   Package the app (signed and notarised with --sign)
  electron-mac-release release ["notes"]  Sign, notarise and publish a GitHub release`;

const [command, ...args] = process.argv.slice(2);
try {
  const config = loadConfig();
  if (command === 'prepare') {
    await prepareAssets(config);
  } else if (command === 'package') {
    console.log(await packageApp(config, { sign: args.includes('--sign') }));
  } else if (command === 'release') {
    await release(config, args.join(' '));
  } else {
    console.error(usage);
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
