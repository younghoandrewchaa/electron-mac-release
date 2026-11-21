// Packages the app with @electron/packager; signs and notarises it when asked.
import { packager } from '@electron/packager';
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { keepOnly } from './config.mjs';

// Thin and universal Mach-O headers, in either byte order.
const machOMagic = new Set([
  0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca,
]);
export function isMachO(file) {
  const fd = openSync(file, 'r');
  try {
    const header = Buffer.alloc(4);
    return readSync(fd, header, 0, 4, 0) === 4 && machOMagic.has(header.readUInt32BE(0));
  } finally {
    closeSync(fd);
  }
}

export function signingOptions(config, env = process.env) {
  const password = env.APPLE_APP_SPECIFIC_PASSWORD || env.APPLE_ID_PASSWORD;
  if (env.APPLE_ID && (!password || !env.APPLE_TEAM_ID))
    throw new Error('APPLE_ID requires APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID.');
  return {
    osxSign: {
      ...(env.APPLE_SIGN_IDENTITY ? { identity: env.APPLE_SIGN_IDENTITY } : {}),
      // Sign only executable code. Resources (.pak, .dat, .png, ...) are sealed by their
      // bundle's signature and should not carry signatures of their own.
      ignore: (file) => statSync(file).isFile() && !isMachO(file),
    },
    osxNotarize: env.APPLE_ID
      ? { appleId: env.APPLE_ID, appleIdPassword: password, teamId: env.APPLE_TEAM_ID }
      : {
          keychainProfile:
            env.APPLE_KEYCHAIN_PROFILE || config.keychainProfile || 'app-signing-profile',
        },
  };
}

export function packagerOptions(config, { sign = false, env = process.env } = {}) {
  return {
    dir: config.cwd,
    name: config.name,
    platform: 'darwin',
    arch: config.arch,
    out: join(config.cwd, config.out),
    overwrite: true,
    ...(env.ELECTRON_MAC_RELEASE_ZIP_DIR
      ? { electronZipDir: env.ELECTRON_MAC_RELEASE_ZIP_DIR }
      : {}),
    ...(config.include ? { ignore: keepOnly(config.include) } : {}),
    ...config.packager,
    ...(sign ? signingOptions(config, env) : {}),
  };
}

// Returns the path of the packaged .app bundle.
export async function packageApp(config, { sign = false } = {}) {
  if (process.platform !== 'darwin') throw new Error('Packaging must run on macOS.');
  const [dir] = await packager(packagerOptions(config, { sign }));
  return join(dir, `${config.name}.app`);
}
