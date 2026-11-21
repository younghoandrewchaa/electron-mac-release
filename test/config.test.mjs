import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { artefactNames, keepOnly, loadConfig } from '../lib/config.mjs';
import { buildManifest } from '../lib/manifest.mjs';
import { packagerOptions, signingOptions } from '../lib/package.mjs';

function project(pkg) {
  const dir = mkdtempSync(join(tmpdir(), 'emr-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

const base = {
  name: 'demo',
  productName: 'Demo',
  version: '1.2.3',
  macRelease: { packager: { appBundleId: 'dev.example.demo' }, include: ['dist'] },
};

test('loadConfig reads names and defaults', () => {
  const config = loadConfig(project(base));
  assert.equal(config.name, 'Demo');
  assert.equal(config.arch, 'arm64');
  assert.deepEqual(config.preRelease, []);
  assert.deepEqual(artefactNames(config), {
    zip: 'Demo-darwin-arm64-1.2.3.zip',
    manifest: 'update-darwin-arm64.json',
  });
});

test('loadConfig requires a bundle id', () => {
  assert.throws(() => loadConfig(project({ ...base, macRelease: {} })), /appBundleId/);
});

test('keepOnly keeps listed top-level entries and package.json', () => {
  const ignore = keepOnly(['dist/']);
  assert.equal(ignore(''), false);
  assert.equal(ignore('/dist'), false);
  assert.equal(ignore('/dist/main/index.js'), false);
  assert.equal(ignore('/package.json'), false);
  assert.equal(ignore('/src/main.ts'), true);
  assert.equal(ignore('/distant'), true);
  assert.equal(ignore('/node_modules/x'), true);
});

test('packagerOptions lets project options override defaults and signs on request', () => {
  const config = loadConfig(
    project({ ...base, macRelease: { ...base.macRelease, keychainProfile: 'demo' } }),
  );
  const plain = packagerOptions(config, { env: {} });
  assert.equal(plain.appBundleId, 'dev.example.demo');
  assert.equal(plain.osxSign, undefined);
  const signed = packagerOptions(config, { sign: true, env: {} });
  assert.deepEqual(signed.osxNotarize, { keychainProfile: 'demo' });
  assert.deepEqual(signingOptions(config, { APPLE_KEYCHAIN_PROFILE: 'env' }).osxNotarize, {
    keychainProfile: 'env',
  });
  assert.throws(() => signingOptions(config, { APPLE_ID: 'a@b.c' }), /APPLE_TEAM_ID/);
});

test('buildManifest points at the release ZIP', () => {
  const manifest = buildManifest({
    name: 'Demo',
    version: '1.2.3',
    repository: 'me/demo',
    zipName: 'Demo-darwin-arm64-1.2.3.zip',
    notes: 'Fixes',
    date: new Date('2026-01-01T00:00:00Z'),
  });
  assert.deepEqual(manifest.releases[0].updateTo, {
    url: 'https://github.com/me/demo/releases/download/v1.2.3/Demo-darwin-arm64-1.2.3.zip',
    name: 'Demo 1.2.3',
    notes: 'Fixes',
    pub_date: '2026-01-01T00:00:00.000Z',
  });
  assert.throws(() => buildManifest({ version: '1.0.0-beta.1' }), /stable semver/);
});
