// Reads the project's package.json and its "macRelease" block.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadConfig(cwd = process.cwd()) {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const mac = pkg.macRelease ?? {};
  if (!mac.packager?.appBundleId)
    throw new Error('package.json needs "macRelease": { "packager": { "appBundleId": ... } }.');
  if (mac.include !== undefined && !Array.isArray(mac.include))
    throw new Error('"macRelease.include" must be an array of top-level paths.');
  if (mac.preRelease !== undefined && !Array.isArray(mac.preRelease))
    throw new Error('"macRelease.preRelease" must be an array of shell commands.');
  const assets = mac.assets === undefined ? {} : mac.assets;
  if (
    !assets || typeof assets !== 'object' || Array.isArray(assets) ||
    Object.entries(assets).some(([from, to]) => !from.trim() || typeof to !== 'string' || !to.trim())
  )
    throw new Error('"macRelease.assets" must map source paths to destination paths.');
  return {
    assets,
    cwd,
    name: pkg.productName || pkg.name,
    version: pkg.version,
    arch: mac.arch || 'arm64',
    out: mac.out || 'out',
    include: mac.include,
    preRelease: mac.preRelease ?? [],
    keychainProfile: mac.keychainProfile,
    packager: mac.packager,
  };
}

// Builds an @electron/packager "ignore" function that keeps only the listed top-level entries
// (plus package.json). Packager passes paths such as "/dist/main/index.js".
export function keepOnly(include) {
  const keep = new Set(['package.json', ...include.map((p) => p.replace(/^\/+|\/+$/g, ''))]);
  return (path) => path !== '' && !keep.has(path.slice(1).split('/')[0]);
}

export function artefactNames({ name, version, arch }) {
  return {
    zip: `${name}-darwin-${arch}-${version}.zip`,
    manifest: `update-darwin-${arch}.json`,
  };
}
