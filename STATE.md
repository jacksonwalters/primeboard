# Primeboard handoff

Updated: **2026-11-23**. Read [AGENTS.md](AGENTS.md) for working instructions.
This is a replaceable snapshot, not a task log.

## Current status

- **Application work:** no unfinished implementation, release build, or deployment
  carried forward. The latest task added these handoff docs; it changes no app
  behavior and requires no release or version bump.
- **Web:** v1.3.2 at [primeboard.jacksonwalters.com](https://primeboard.jacksonwalters.com/).
- **Desktop:** [v1.3.2](https://github.com/jacksonwalters/primeboard/releases/tag/v1.3.2),
  Linux ARM64 and x64, each with a DEB installer and ZIP; checksums attached.
  The [download page](https://primeboard.jacksonwalters.com/download.html) points
  to these assets. Web and desktop versions currently match.
- **Release source:** `9f59770084615fc47b2190e7577a135259038af4` on `master`;
  repository [jacksonwalters/primeboard](https://github.com/jacksonwalters/primeboard).
  Later documentation commits do not change these binaries.
- **Last release verification, 2026-11-22:** 163 tests passed on both native Linux
  runners. Each DEB passed install/removal checks on Debian 12/13 and Ubuntu
  22.04/24.04. Package hashes, architecture, version, permissions, and bundled
  source/data were verified. Public assets and deployed web files were checked;
  the download page showed v1.3.2. Evidence:
  [desktop workflow](https://github.com/jacksonwalters/primeboard/actions/runs/45072561189)
  and [release notes](desktop/releases/v1.3.2.md). These are past results, not
  checks of a future working tree.

## Next action and open items

Start from the user's new request; there is no queued feature or deployment.
Hardware smoke testing remains: install the ARM64 DEB on Jackson's Raspberry Pi 5
with a 64-bit desktop OS and test MIDI, volume, audio latency, fullscreen, and
representative visualizations. Do not report this as completed from container CI.
Jackson has confirmed that the **M-Audio Keystation Mini 32 MK3** plays correctly
and its volume knob works in Chrome. That is browser/controller evidence, not a
Pi desktop test.

Naming is deferred, not a blocker. Keep Primeboard until a replacement is chosen;
the [dated naming shortlist](docs/naming-shortlist.md) records unresolved research.
The repository remains personal and open source. No move to an organization,
closed-source conversion, app-store release, or macOS/Windows signing is planned.

## Where to work

| Area | Entry points |
| --- | --- |
| UI and explanations | `web/app.js`, `web/index.html`, `web/style.css` |
| Input and volume | `web/instrument.js`, `web/pointer-keyboard.js`, `web/midi.js`, `web/volume-control.js` |
| Audio and driven modes | `web/audio.js`, `web/resonator.js`, `web/resonator-worklet.js`, `web/resonator.txt` |
| Visualizations | `web/color.js`, `web/plate-display.js`, `web/chladni-sand.js`, `web/cube-view.js`, `web/cantor-view.js` |
| Songs, recordings, export | `web/song.js`, `web/recording.js`, `web/video-export.js`, `web/export-*.js` |
| Fullscreen | `web/fullscreen.js`, `tests/fullscreen.test.mjs` |
| Desktop and release checks | `desktop/main.mjs`, `desktop/security.mjs`, `forge.config.mjs`, `.github/workflows/desktop.yml`, `scripts/desktop-*` |

Find related regression tests in `tests/`; [README.md](README.md) has the detailed
model/source map. Latest behavior additions are playable fullscreen (1.3.1) and
MIDI CC7 master volume (1.3.2). Avoid rediscovering their design from old chats.

## Release continuation

Web and desktop releases are independent. Follow the linked runbooks instead of
assuming every web change needs new binaries.

- **Web:** [deployment runbook](deploy/README.md).
  `bash scripts/stage-deploy.sh` tests, builds, and uploads; it does not install.
  Production access uses Jackson's configured `application_server` SSH alias.
  A contributor can run locally without that access. The final install command is
  `ssh -t application_server 'sudo bash /home/jackson/primeboard-deploy/install.sh'`.
- **Desktop:** [build/release runbook](desktop/README.md). Prepare notes in
  `desktop/releases/v<version>.md`, push the intended source, then dispatch
  `gh workflow run desktop.yml --ref master -f prepare_release=true` from the
  repository with authorized GitHub access. This builds both architectures,
  verifies them, and creates a **draft**, not a published release. Inspect the run
  and draft, publish, verify public asset URLs/checksums, then deploy download
  links. Keep large binary verification in CI rather than downloading every
  artifact locally.

No temporary local script, open terminal session, or earlier chat is needed to
resume. Update this snapshot when that changes.
