// Builds the Squirrel.Mac JSON manifest that the app reads from the latest GitHub release.
const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function assertStableVersion(version) {
  if (!stableSemver.test(version ?? ''))
    throw new Error(`Updates require a stable semver version, got "${version}".`);
}

export function buildManifest({
  name,
  version,
  repository,
  zipName,
  notes = '',
  date = new Date(),
}) {
  assertStableVersion(version);
  return {
    currentRelease: version,
    releases: [
      {
        version,
        updateTo: {
          url: `https://github.com/${repository}/releases/download/v${version}/${zipName}`,
          name: `${name} ${version}`,
          notes,
          pub_date: date.toISOString(),
        },
      },
    ],
  };
}
