import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));

test('prepare copies individual files and asset directories on every build', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'prepare-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const macRelease = {
    packager: { appBundleId: 'dev.example.demo' },
    assets: { 'index.html': 'dist/renderer/index.html', icons: 'dist/assets' },
  };
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ macRelease }));
  mkdirSync(join(cwd, 'icons'));
  writeFileSync(join(cwd, 'icons/tray.png'), Buffer.from([0, 255]));
  for (const html of ['first', 'updated']) {
    writeFileSync(join(cwd, 'index.html'), html);
    const result = spawnSync(process.execPath, [cli, 'prepare'], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(cwd, 'dist/renderer/index.html'), 'utf8'), html);
    assert.deepEqual(readFileSync(join(cwd, 'dist/assets/tray.png')), Buffer.from([0, 255]));
  }
});
