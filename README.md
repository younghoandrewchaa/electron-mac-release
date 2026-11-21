# electron-mac-release

Packages an Electron app for macOS, signs and notarises it, and publishes it to GitHub Releases with a Squirrel.Mac JSON update manifest (`update-darwin-<arch>.json`).

## Install

```sh
npm i -D github:<owner>/electron-mac-release#v1.0.0
```

## Configure

Add a `macRelease` block to the app's `package.json`. The app name comes from `productName` (or `name`) and the version from `version`.

```json
"scripts": {
  "package": "npm run build && electron-mac-release package",
  "release": "electron-mac-release release"
},
"macRelease": {
  "include": ["dist"],
  "preRelease": ["npm test", "npm run build"],
  "keychainProfile": "app-signing-profile",
  "packager": {
    "appBundleId": "dev.example.app",
    "appCategoryType": "public.app-category.productivity",
    "icon": "dist/assets/app.icns",
    "asar": false,
    "extendInfo": { "LSUIElement": true }
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `packager` | required | Passed straight to `@electron/packager`. `appBundleId` is required. |
| `include` | everything | Top-level entries to ship. `package.json` is always kept. |
| `preRelease` | `[]` | Shell commands run before packaging a release. Put your build here. |
| `keychainProfile` | `app-signing-profile` | `notarytool` keychain profile used for notarisation. |
| `arch` | `arm64` | Architecture to build. Releases must run on a Mac of that architecture. |
| `out` | `out` | Output directory. Release artefacts go to `<out>/make`. |

## Commands

- `electron-mac-release package` packages an unsigned app. Add `--sign` to sign and notarise it.
- `electron-mac-release release "Release notes"` checks that the tree is clean and the version is unreleased, runs `preRelease`, packages, signs, notarises and verifies the app, zips it with `ditto`, writes the update manifest, tags the commit, uploads both files to a draft release and publishes it as the latest. Without notes it prompts for them.

The GitHub repository is read from `gh repo view`. The app should read its updates from `https://github.com/<owner>/<repo>/releases/latest/download/update-darwin-<arch>.json`.

## Environment

- `APPLE_KEYCHAIN_PROFILE` overrides `keychainProfile`.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (or `APPLE_ID_PASSWORD`) and `APPLE_TEAM_ID` notarise with an Apple ID instead of a keychain profile.
- `APPLE_SIGN_IDENTITY` picks a signing identity.
- `ELECTRON_MAC_RELEASE_ZIP_DIR` points at a directory holding the Electron ZIP, for offline packaging.
