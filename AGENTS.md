# Working on Primeboard

## Start with a fresh context

Read [STATE.md](STATE.md), then run `git status --short --branch` and
`git log -5 --oneline`. Read only the files and documentation relevant to the
request. Previous chats are not required. Treat STATE's deployment and test
results as dated evidence; the checkout, workflow results, and live site may
have advanced. Preserve existing uncommitted work.

## Project and local development

Primeboard is a static HTML/CSS/JavaScript musical instrument. The same `web/`
assets run in the browser and an Electron desktop wrapper. There is no backend,
account system, telemetry, or runtime CDN dependency. Models and music are bundled;
Python is only for offline model generation.

Use Node.js 22+ for web work; desktop builds use Node.js 24. From the repository:

```sh
npm run dev       # http://127.0.0.1:5173
npm test          # Node's built-in test runner
npm run build    # static output: dist/web/
```

These web commands need no dependency installation. Run `npm ci` for Electron
development or regenerating vendored video code. See [README.md](README.md) for
behavior, model details, and the source map, and [desktop/README.md](desktop/README.md)
for desktop setup. Do not regenerate numerical assets for unrelated changes.

## Decisions to preserve

- Personal, MIT-licensed project at `jacksonwalters/primeboard`. Keep the separate
  CIE data license and bundled attribution. The current name is Primeboard;
  naming research lives in [docs/naming-shortlist.md](docs/naming-shortlist.md).
- Desktop distribution targets Raspberry Pi ARM64 and Linux PC x64. Keep the
  runtime self-contained. Automatic CI builds only Pi; manual desktop runs build
  both architectures. macOS/Windows packaging code and historical releases may
  remain, but those platforms are outside the current release plan.
- Keep controls uncluttered. Put usage examples in **How to use**, model and
  sound explanations in **The math** (`web/index.html`). Update them when changing
  behavior. Note labels and scale guides describe existing pitches; they do not
  retune the instrument.
- Share input, playback, recording, and export behavior across views. Preserve
  source-aware note ownership, cleanup on release/disconnect/focus loss, mobile
  touch handling, and playable fullscreen. Modal holds continuously drive a
  damped oscillator; Cantor sound follows the normalized set operation.

## Checks and releases

For behavior changes, add focused regression coverage where useful, run
`npm test` and `npm run build`, and check the affected browser interaction.
Automated installation checks do not establish physical MIDI, GUI, or audio
latency behavior. For documentation-only work, check links and
`git diff --check`; skip application builds and tests.

Follow the user's requested scope: a code change does not by itself request a
deployment. When a release is requested, use [deploy/README.md](deploy/README.md)
and [desktop/README.md](desktop/README.md). `package.json` is the app-version
source; `npm version <version> --no-git-tag-version` synchronizes both footers.
The download label and URLs track the separately published desktop version.
Publish and verify installers before deploying links to them. Never replace an
existing published version's assets just to rebuild them.

Production staging is not installation. The server's final sudo step has needed
Jackson's interactive password: finish staging, report the actual failure if it
recurs, and give the documented terminal command. Never request credentials in
chat. After installation, verify the public files and relevant behavior.

## Keep the handoff small

At a task boundary, update STATE when status, release versions, decisions, or
remaining work change. Before leaving unfinished work, record the objective,
branch/commit and dirty files, tests already run, exact next action, blockers,
and any active job's durable URL. Distinguish local, pushed, staged, and live.
If nothing is pending, say so explicitly.

Replace stale status instead of appending a diary. Keep AGENTS and STATE roughly
under 1,200 words combined. Put durable detail in the relevant existing docs and
link to it; use Git history and release notes for completed changes. Do not rely
on chat history, private local paths, or temporary scripts for resuming work.
Do not store secrets. A fresh chat can begin: “Read AGENTS.md and STATE.md, then
[task].”
