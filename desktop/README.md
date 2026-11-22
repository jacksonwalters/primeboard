# Primeboard desktop

Desktop releases target Raspberry Pi (Linux ARM64) and Linux PCs (x64).
The desktop app bundles the same instrument, model data, music, and documentation
as the website with Electron. It runs offline and does not need a local server,
Node.js, Python, or a browser installation. Links to outside references open in
the system browser.

## Downloads and installation

Download an installer from the [Primeboard download page](https://primeboard.jacksonwalters.com/download.html)
or the [public release](https://github.com/jacksonwalters/primeboard/releases/tag/v1.3.2).
No GitHub account is needed. Choose the package for your computer:

| Computer | Download | Installation |
| --- | --- | --- |
| Raspberry Pi 5 with 64-bit Raspberry Pi OS | Linux arm64 `.deb` | Install the package, then launch Primeboard from the applications menu. |
| Debian or Ubuntu PC | Linux x64 `.deb` | Install the package, then launch Primeboard from the applications menu. |

ZIP bundles are also produced for both targets. Extract the entire archive
and run `Primeboard`.
Keep the accompanying runtime files with the executable. Linux packages are the
preferred installation route because the package manager resolves dependencies.
For a downloaded Debian package, `sudo apt install ./Primeboard-1.3.2-Linux-arm64.deb`
installs the Pi build (use the actual downloaded filename).

Releases do not auto-update yet; installing a newer version retains the app's
local data.

Release downloads are permanent GitHub Release assets, with a `SHA256SUMS.txt`
file for integrity checks. On relevant pushes and pull requests, the **Desktop
builds** workflow runs the full test suite and builds only Linux ARM64 for the
Raspberry Pi. To build both Linux architectures on native Linux runners,
open **Actions → Desktop builds → Run workflow**. Manual builds run
independently of automatic Pi checks, so a new push does not cancel a manual
build. Manual runs also install and remove each DEB in clean Debian 12/13 and
Ubuntu 22.04/24.04 containers, checking runtime libraries, the desktop launcher,
and sandbox permissions. These checks do not replace graphical, audio, and MIDI
testing on physical hardware. Temporary CI artifacts are staging outputs, not the public download
links. Publish the completed installers as a versioned release before deploying
a download page that points to that version.

For a release, select **Verify packages and upload a draft GitHub release** when
starting the workflow. After both builds and installation checks pass, it checks
the package hashes, architectures, versions, sandbox permissions, and bundled
source/data files, then uploads DEB and ZIP files with `SHA256SUMS.txt` directly
to a draft release. Release notes come from `desktop/releases/v<version>.md`.
Review and publish the draft before deploying the updated download links.

The footer shows the app version from `package.json`; the download page's
**Current version** label and installer links describe the published desktop
release. Advance the app version for web releases with, for example,
`npm version 1.0.1 --no-git-tag-version`. This updates the package metadata and
both footers. Development, web builds, and desktop packaging also synchronize
the footers. Leave the download label and links unchanged until new installers
are published. Web updates do not require a new desktop release.

## MIDI, recordings, and storage

Use **Connect keyboard**, then press the leftmost physical key to calibrate.
MIDI access is allowed only for the bundled instrument, which requests basic
MIDI with `sysex: false` and ignores SysEx messages. Chromium reports this request
under its shared `midiSysex` permission name. No MIDI driver
or extra browser permission prompt is required for a class-compliant controller,
though the operating system must recognize the device. The Pi needs a working
desktop session and audio output. Hardware MIDI and audio latency should be
checked on the actual Pi and controller.

The keyboard's volume knob (CC7) controls Sound volume and updates the on-screen
slider, including during songs and fullscreen. The M-Audio Keystation Mini 32
MK3 uses this assignment by default. Volume changes do not alter the note mapping
or visualizations and are not stored as recording events.

Saved recordings and device calibration live in the desktop app's profile,
separately from browser storage. Linux uses `$XDG_CONFIG_HOME/Primeboard`,
normally `~/.config/Primeboard`.

Video, replay-file, and image exports use a native Save dialog. The instrument's
existing save/replace confirmations remain in place. The expand button in the
visualization opens playable fullscreen; Show keyboard restores the touch keys,
and Escape or the exit button returns to the regular view without clearing notes.
Whole-window fullscreen is also available in the View menu; press Alt to show the
menu bar on Linux.

## Development and builds

With Node.js 24 or newer:

```sh
npm ci
npm run desktop:start
npm test
npm run desktop:make
npm run desktop:checksums
```

The default target is the host's OS and architecture. Use `-- --arch=x64` or
`-- --arch=arm64` for packaging another supported architecture. Build native
Linux installers on Linux; a manual GitHub workflow run supplies both Linux
build architectures. Linux makers need `fakeroot` and `dpkg`.
Outputs are under `out/make/`; unpacked applications are
under `out/Primeboard-<platform>-<arch>/`. Development uses a separate
`Primeboard Development` profile, so testing leaves installed-app data alone.

Icons are generated from the existing `web/icon.svg`. Only `web/`, `desktop/`,
the production startup dependency, package metadata, and license are bundled.
Tests, development dependencies, deployment scripts, and model-solving tooling
are excluded. The website's `npm run dev`, `npm test`, and `npm run build` commands
continue to work independently.

The app uses a private secure `primeboard://app/` origin so ES modules, fetch,
Web Audio worklets, WebGL, local storage, MIDI, and generated downloads work
without a network listener. Renderers remain sandboxed with Node integration
disabled, and only local assets execute. External URLs can only use HTTP(S),
and only MIDI, clipboard writing, and fullscreen permissions are allowed.
