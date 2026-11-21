// Builds a signed, notarised app locally, uploads it to a draft, then publishes the version on GitHub.
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { artefactNames } from './config.mjs';
import { assertStableVersion, buildManifest } from './manifest.mjs';
import { packageApp } from './package.mjs';

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}
function read(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function tryRead(cmd, args, cwd) {
  try {
    return read(cmd, args, cwd);
  } catch {
    return null;
  }
}

async function askNotes() {
  if (!process.stdin.isTTY) throw new Error('Usage: electron-mac-release release "Release notes"');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question('Release statement: ')).trim();
  } finally {
    rl.close();
  }
}

export async function release(config, notesArg) {
  const { cwd, version, arch } = config;
  if (process.platform !== 'darwin' || process.arch !== arch)
    throw new Error(`Releases must be built on macOS ${arch}.`);
  assertStableVersion(version);
  run('gh', ['auth', 'status'], cwd);
  if (read('git', ['status', '--porcelain'], cwd))
    throw new Error('Commit or stash changes before releasing.');

  const tag = `v${version}`;
  const isDraft = tryRead(
    'gh',
    ['release', 'view', tag, '--json', 'isDraft', '-q', '.isDraft'],
    cwd,
  );
  if (isDraft === 'false')
    throw new Error(`Release ${tag} is already public; bump package.json's version first.`);
  const tagCommit = tryRead(
    'git',
    ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`],
    cwd,
  );
  if (tagCommit && tagCommit !== read('git', ['rev-parse', 'HEAD'], cwd))
    throw new Error(`Tag ${tag} points to another commit; bump the version first.`);

  const notes = (notesArg ?? '').trim() || (await askNotes());
  if (!notes) throw new Error('Release notes must not be empty.');

  const repository = read(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    cwd,
  );

  for (const command of config.preRelease) execSync(command, { cwd, stdio: 'inherit' });

  const names = artefactNames(config);
  const makeDir = join(cwd, config.out, 'make');
  const zipPath = join(makeDir, names.zip);
  const manifestPath = join(makeDir, names.manifest);
  // Remove old artefacts so they cannot satisfy this release.
  rmSync(zipPath, { force: true });
  rmSync(manifestPath, { force: true });
  mkdirSync(makeDir, { recursive: true });

  const appPath = await packageApp(config, { sign: true });

  // The packager signs, notarises and staples the app; check all three.
  run('codesign', ['--verify', '--deep', '--strict', appPath], cwd);
  run('xcrun', ['stapler', 'validate', appPath], cwd);
  run('spctl', ['--assess', '--type', 'execute', appPath], cwd);

  // ditto keeps the bundle's symlinks and metadata, which Squirrel.Mac needs.
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], cwd);
  const manifest = buildManifest({
    name: config.name,
    version,
    repository,
    zipName: names.zip,
    notes,
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (!tagCommit) run('git', ['tag', '-a', tag, '-m', notes], cwd);
  run('git', ['push', 'origin', `refs/tags/${tag}`], cwd);
  if (isDraft !== 'true')
    run(
      'gh',
      ['release', 'create', tag, '--draft', '--verify-tag', '--title', tag, '--notes', notes],
      cwd,
    );
  run('gh', ['release', 'upload', tag, zipPath, manifestPath, '--clobber'], cwd);
  run('gh', ['release', 'edit', tag, '--draft=false', '--latest', '--notes', notes], cwd);
  console.log(`Released ${tag}`);
}
