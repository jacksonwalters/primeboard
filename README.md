# Primeboard

A playable keyboard of prime numbers, spectral light, and sine tones.
Public app: **https://primeboard.jacksonwalters.com**.

Primeboard remains the current name while we explore a more distinctive future
name. See the [naming shortlist and trademark notes](docs/naming-shortlist.md).

The browser app is static HTML, CSS, and JavaScript, with locally bundled video
encoding support and no accounts, telemetry, external assets, or backend.
The CIE table is bundled locally.
The former `synesthesiaer` Python CLI is retired and its legacy files removed.
This repository no longer builds or publishes a Python package.
Existing PyPI releases have not been deleted or changed.

Native desktop packages for Linux PCs (x64) and Raspberry Pi (ARM64)
bundle the instrument for offline use. See
[desktop installation and build instructions](desktop/README.md). The desktop
build tools are development dependencies; the static website remains unchanged.

## Run

With Node.js 22 or newer:

```sh
npm run dev       # http://127.0.0.1:5173
npm test          # color, input, audio, song, and surface-mode checks
npm run build    # deployable static files in dist/web/
```

No dependency installation is necessary. Any static HTTP server can serve `web/`
directly. ES modules and the local CSV fetch require HTTP, rather than `file://`.

## Play

- **Note labels and scale guide** describe the audible pitches in every view.
  The smaller key label shows the nearest note (A4 = 440 Hz), prefixed with `≈`
  when more than 5 cents away. Hover or focus a key for its frequency and signed
  cents offset. Sphere octave shifts update the labels while retaining natural
  frequencies in the details. Choose a root and a major, natural minor, or
  pentatonic guide to highlight pitches within 25 cents of a scale note.
  All keys remain playable at their original frequencies. The count includes
  repeated pitches; a guide does not guarantee a complete scale in any octave.
  The guide starts off and never changes audio, recordings, or set operations.
- **Cantor algebra** shows four middle-third removals above the unit interval.
  The second settings row selects **Union ∪** (default) or **Intersection ∩**.
  The QWERTY letters select prefix cylinders in breadth-first tree order:
  `∅, 0, 1, 00, 01, 10, 11, …`. All prefixes through length 4 fit 31 keys:
  `[ ] ; , .` extend the letters with `1011, 1100, 1101, 1110, 1111`.
  `Q` is labeled `∅` for the empty prefix, whose cylinder is the whole Cantor set;
  `/` adds the empty set as the 32nd key. Its “empty set” caption distinguishes
  it from the root. It absorbs intersections and leaves unions unchanged.
  Union uses a canonical disjoint cover: contained cylinders are redundant,
  and complete sibling pairs merge recursively into their parent. Thus
  `C(10) ∪ C(101) = C(10)` and `C(100) ∪ C(101) = C(10)`.
  Intersection keeps the longest compatible prefix or produces `∅`.
  The diagram and audio follow the simplified result. Shadows mark
  its containing intervals; bright bars and finer fragments on `[0,1]`
  approximate the cylinders while preserving removed gaps. Empty results have no
  highlights and are silent. No active keys leave the instrument idle and silent.
  Each resulting cylinder sounds one fixed-amplitude sine tone. Parent tones can
  emerge even when their keys are not held. For prefix length `n` and binary value
  `k`, its frequency is `110 * (2^n + k)` Hz; the whole set sounds at 110 Hz.
  Changing the operation updates held notes immediately and reschedules playing
  songs at their current position. Sustain, Clear, pointer input, recordings,
  and video export work in both modes. Takes store key timings and replay/export
  through the currently selected operation. Examples live in **How to use**;
  **The math** explains normalization and the unchanged harmonic pitch mapping.
- **Flat plate** includes Colored nodes, Vibration strength, Mode mixture, and
  **Sand particles**. Sand follows 6,000 persistent grains on either plate model;
  hold a key or use Sustain to drive its natural frequency continuously. Grains
  move more in strongly excited regions and gradually collect near nodes.
  Equal-frequency modes interfere coherently; different frequencies contribute
  separate averaged powers, so chords need not produce complete nodal lines.
  This is a stochastic transport approximation, with an illustrative time scale
  and reflecting rim, not a calibrated collision, friction, or airflow solver.
  **Redistribute sand** scatters the grains; Clear stops excitation while
  preserving their positions. Freeze, reduced motion, playback pause, hidden
  views, and hidden tabs pause transport. Recordings retain key timings, not
  grain positions or redistribution gestures; video export captures the current
  particle evolution. **How to use** and **The math** explain the controls and
  approximation. The original presets, freeze control,
  note labels, and optional Prime encoding are available in this view. See the
  [square-plate model](web/modes.txt) for its basis and driven dynamics.
- **Rounded cube** displays a rounded thin metal surface, with one computed surface
  eigenmode per prime. Drag the cube to turn it, or focus it and use arrow keys.
  **Sustain** keeps the modes selected with the keyboard visible. Chords combine
  patterns; bright lines trace their zeros. **Pause motion**, **Reset view**, and
  **Save image** support inspection and PNG export. **Light** restores the
  original display. Reduced-motion preferences start the animation paused.
- **Music library**, below the keyboard and settings, offers ten public-domain
  themes and excerpts: *Ode to Joy*, *Für Elise*, *Minuet in G*, *Eine kleine
  Nachtmusik*, Bach's *Prelude in C major*, *Gymnopédie No. 1*, *Brahms’ Lullaby*,
  Chopin's *Prelude in A major*, *Old French Song*, and Mozart's *Ah! vous
  dirai-je, maman* theme. These are short arrangements for the 26-key instrument.
  It also includes *Branches Return*, an original 30-second composition by
  Codex for Cantor Union. Selecting it opens that view and operation. A melody,
  stable 4:5:6 chords, and deliberate sibling merges lead to a final root tone;
  [the prefix score](web/music/branches-return.txt) gives the complete gestures.
  **Play song** synchronizes key highlights, colors, exact integers, and audio.
  Pause/resume, restart, stop, and three speeds are available. Selecting a song
  resets its position while preserving the selected speed and whether playback
  is running; otherwise press Play to start it. Playback continues across views and focus changes. Manual key and preset changes
  wait until playback is stopped; use Pause or Stop to control the song. Lead/upper parts use weight 2 and supporting
  parts use weight 1; long song notes keep fixed weights. The hold-intensity
  control continues to apply to live keys. See
  [music provenance and arrangement notes](web/music/README.txt).
- Type QWERTY letters, click keys, or touch multiple keys. Drag across the keys to play.
- In Number, every press starts at exponent 1. Holding increases it at a configurable interval
  (default 500 ms, independent of OS key repeat), up to 32.
- Toggle **Sustain** (or press Space outside controls) to retain released notes.
  Pressing a sustained key again adds 1 to its exponent.
- **Clear** or Escape resets the mixture. Leaving the window or hiding the page
  also clears it, preventing stuck sound and unnoticed background accumulation.
- **Sound** is on by default and starts on the first interaction. Toggle it off to mute sound. Light uses sine tones, C3 through C♯5,
  using browser Web Audio. Each tone's amplitude is proportional to the square
  root of its exponent, so holding a key increases its power. Chords are summed
  before a shared output compressor and soft limiter; master volume is bounded.
- In Light, the keys encode a positive integer using the first 26 primes
  (2 through 101). The integer and exponents are exact `BigInt` values.
- **Screen exposure** changes only the preview. It does not change the number,
  spectral power, XYZ, or sound.

Physical letter positions use `KeyboardEvent.code`, with QWERTY labels. Click the
keyboard or Enable sound to give it focus. Letter keys continue to work after
adjusting sliders. Some
physical keyboards limit simultaneous keys; pointer input and sustain also work.

## USB MIDI keyboards

Connect a class-compliant USB MIDI keyboard and open the app in a browser with
Web MIDI support (Chrome/Chromium, including on the Raspberry Pi). HTTPS or
localhost is required. Choose **Connect keyboard**, allow MIDI access, and select
the device if necessary. On the first connection, press its leftmost key to
calibrate. This press does not sound or enter a recording. Device selection and
each device’s first note are saved locally; connecting remains an explicit click.
Use **Set first key** after changing hardware octave or transpose settings.

With MIDI note `m₀` at the left edge, note `m` selects index `m − m₀`. All 32
consecutive notes, including black keys, map to Cantor’s 31 prefixes and the
empty set. The other views use the first 26 notes and ignore the remaining six.
Out-of-range notes are ignored. These are input addresses: the existing pitches
and Cantor set operations remain unchanged. Positive velocity has fixed initial
strength; pitch bend and expression (CC11) are ignored.

The selected keyboard’s volume knob (CC7, including the Keystation Mini 32 MK3’s
default assignment) controls master sound volume. Its full 0–127 range maps to
the existing 0–50% gain range, with the slider and percentage following the knob.
All MIDI channels control the same master volume; pitches, input strengths, and
visualizations are unaffected. The knob also works during song playback and in
fullscreen, and it does not unmute Sound off. Keep this window focused to use it.
Like the on-screen slider, volume changes are not stored as recording events;
video export uses the volume selected when export starts.

Note-off and zero-velocity note-on release notes. CC64 provides channel-specific
pedal sustain that keeps modal drivers on (or retains Number exponents); the on-screen Sustain button can
also retain notes after the pedal lifts. CC123 releases notes through sustain,
and CC120 force-releases the channel. MIDI, QWERTY, and pointer sources cannot
release one another’s notes. Switching or unplugging a device clears its held
and sustained notes; reconnecting restores its calibration. Clear, focus loss,
view changes, and starting playback reset MIDI input. Playback blocks live notes;
video export blocks live notes and volume changes. MIDI uses the existing
recording and audio paths.

`tests/midi.test.mjs` exercises simulated ports with the real instrument,
recording, and Cantor audio projection. Physical USB hardware still needs a
smoke test on the target Pi/browser.

## The model

For zero-based key index `i = 0..25`, assign prime `p_i` and wavelength
`lambda_i = 700 * (400/700)^(i/25)` nm. This makes optical frequencies `c/lambda_i`
logarithmically spaced from red to violet. This is a useful slice of the visible
spectrum, not a claim that human vision ends exactly at 400 and 700 nm.

The state consists of integer exponents `e_i` from 0 to 32:

```text
n = product(p_i ^ e_i)
S_lambda(lambda) = sum(e_i * delta(lambda - lambda_i))
(X, Y, Z) = sum(e_i * (x_bar(lambda_i), y_bar(lambda_i), z_bar(lambda_i)))
```

An exponent is relative integrated radiant power, not photon count. A delta line's
integrated weight is unchanged by switching from wavelength to frequency; a
continuous spectral density would require the appropriate Jacobian. Mixing does
not create a new frequency, average wavelengths, or mix gamma-encoded RGB.

Unique prime factorization is a lossless encoding of this finite spectral state.
Multiplying encoded numbers adds spectral weights (where the resulting weights
fit the instrument's limit). Squaring a number doubles XYZ and preserves
chromaticity. Different spectra can share the same XYZ (metamerism), so the final
color is not a unique encoding of the integer.

Official [CIE 1931 2° data](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer)
is sampled at 1 nm and linearly interpolated. The app exposes unmodified relative
luminance Y and chromaticity x,y; hover the luminance readout for full XYZ.

### Screen limitations

XYZ is converted to linear sRGB using the D65 matrix from
[W3C CSS Color 4](https://www.w3.org/TR/css-color-4/#color-conversion-code).
Pure spectral light usually lies outside the sRGB gamut. Negative channels are
clipped, then a shared exposure scale compresses brightness:

```text
r = max(0, M * XYZ)       # componentwise
m = max(r)
display_linear = r * (1 - exp(-exposure * m)) / m  # black when m = 0
```

Apply the standard sRGB transfer function last. This explicit preview transform
does not claim exact screen reproduction of spectral light. The numeric XYZ
stays untouched; the screen glow is decorative, and the displayed hex value is
the computed color. Keycap colors are normalized for visibility.

Equal radiant power is not equal perceived brightness. Deep red and violet may
look dim. Full spectrum is a sum of 26 equal-power lines, not a calibrated D65
illuminant or a promise of white.

### Light-view sound from the same exponents

Each prime also maps to a fixed audible frequency, `440 * 2^((48+i-69)/12)` Hz.
The positive-frequency power spectrum is proportional to
`sum(e_i * delta(f - f_i))`. The corresponding steady-state signal is
`s(t) = A0 * sum(sqrt(e_i) * sin(2*pi*f_i*t + phase_i))`, with `A0 = 0.18`.
Distinct tones add; a sine's average power is its squared amplitude divided by
two. Multiplying numbers adds spectral power weights. It does not mean adding
two phase-coherent copies of the same sine at full amplitude.

Adding a note leaves the other oscillators' target gains unchanged. Smooth
attack/release envelopes prevent clicks. After the linear sum, a compressor
and a final soft limiter bound loud chords before master volume. This output
processing, like the color preview's tone mapping, can change the delivered
spectrum when engaged; the encoded powers and raw sine mixture stay separate.

### Rounded aluminum shell

The cube now uses a linear **MITC4 elastic-shell calculation**, including bending,
stretching, transverse shear and curvature coupling. The assumed object is a
freely suspended aluminum shell: 20 cm outside width, 3 cm outside corner radius,
and 1 mm walls (E = 69 GPa, ν = 0.33, density = 2700 kg/m³).

An offline generalized stiffness/mass eigenproblem supplies vector displacement
modes and natural frequencies. Six rigid-body motions are excluded. The solve
checks a flat-plate benchmark, eigenpair residuals, mass orthogonality, and mesh
refinement. The displayed field is each vector mode's **normal component**;
its zeros need not be zeros of tangential motion.

The cube stays fixed while the selected patterns grow and fade. These are modal
envelopes, not literal vibration. Held keys drive their modes continuously at
the calculated natural pitches. Sound and visual strength use the same damped
oscillator: buildup toward equilibrium, then ringdown on release. The key’s ×
readout shows normalized response strength; a fresh held key settles near ×1.0.
Sustain retains the driver, and replaying a sustained key adds driver weight.
Damping and sound radiation are still illustrative. See the
[full model and reproduction notes](web/data/modes/README.txt).

To regenerate (Python 3.14):

```sh
python3 -m venv .venv-shell
.venv-shell/bin/pip install --no-deps -r scripts/requirements-shell.txt
.venv-shell/bin/python scripts/solve_shell.py --corner 6 --refine 8
```


## Deployment

Use the existing `application_server` SSH host. See [deployment instructions](deploy/README.md).
The app needs one DNS A record and an Nginx static host with HTTPS; no app service,
database, process manager, or Python environment is needed.

## Layout

- `web/color.js`: pure spectral math, exact integer encoding, display conversion.
- `web/instrument.js`: source-aware input ownership, holds, sustain, reset.
- `web/midi.js`: Web MIDI connection, calibration, device lifecycle, and pedal input.
- `web/audio.js`: persistent Web Audio voices, attack/release, bounded output.
- `web/app.js`: keyboard, pointer, accessibility, graph, and UI integration.
- `web/song.js`: classical and original music library, spectra, and audio-clock transport.
- `web/modes.js`: decoding and dynamic mixing of surface modes.
- `web/resonator.js`, `web/resonator-worklet.js`: analytic damped modal dynamics and sample-rate audio synthesis.
- `web/plate-modes.js`, `web/plate-display.js`: square-plate basis and all three 2D readouts.
- `web/cube-view.js`: WebGL2 rendering, rotation, motion, and PNG export.
- `web/cantor.js`, `web/cantor-view.js`: prefix-cylinder unions and intersections, ternary
  intervals, and the Cantor construction with projected shadows.
- `scripts/solve_modes.py`: rounded geometry, FEM eigenproblem, and numerical checks.
- `web/music/catalog.js`: bundled note events, generated offline; no runtime MIDI file parser.
- `music-sources/`: original public-domain score/MIDI downloads and arrangement manifest.
- `scripts/import-music.mjs`: dependency-free, offline score importer; regenerate with
  `node scripts/import-music.mjs`. Tests verify source checksums and generated data.
- `web/data/`: official CIE data, metadata, attribution, and detailed model notes.
- `tests/`: Node's built-in test runner; no test dependencies.

Software: MIT. CIE data: **CC BY-SA 4.0**, separately attributed in the app and
[`web/data/README.txt`](web/data/README.txt). The CSV is unmodified and its published
SHA-256 checksum is checked by the tests.

### Free aluminum plate

The Flat plate view also offers **Free plate**, a 20 × 20 cm, 1 mm aluminum
plate with unconstrained edges. Its first 26 transverse bending modes use
MITC4 Reissner–Mindlin elements and the same material as the shell. The three
transverse rigid motions are excluded; in-plane vibration is outside this model.
Actual predicted frequencies drive the sound; visual envelopes and damping are
illustrative. The existing simply supported model remains available.

Reproduce with `.venv-shell/bin/python scripts/solve_plate.py` using
`scripts/requirements-shell.txt`. The exported 48 × 48 element solve is checked
against a 32 × 32 mesh, rigid motions, mass orthogonality, eigen residuals, and a
simply supported analytical benchmark. See `web/data/modes/free-plate.json`
for diagnostics and `web/data/modes/free-plate.bin` for normalized grid fields.
Boundary-condition reference: [NGSolve plate derivation](https://docu.ngsolve.org/ngs24/SaS/plates_derivation.html).

### Sphere

**Sphere** shares the 3D controls and offers **Elastic shell** and **Scalar surface**.
The elastic model is a free aluminum shell, 20 cm outside diameter and 1 mm wall,
with a 9.95 cm midsurface radius. Its lowest 26 elastic modes all have substantial
normal displacement. Their calculated pitches are approximately 5.9–7.7 kHz;
the display shows their normal components on fixed geometry. The complete spectrum
also includes tangential torsional modes, which are outside this selected set.

Scalar surface uses exact real spherical harmonics on the unit sphere, labels
`(ℓ,m)`, and eigenvalues `ℓ(ℓ+1)`. Positive `m` is cosine longitude, negative `m`
is sine longitude, and zero is axisymmetric. The constant mode is omitted; pitches
are illustrative with a 110 Hz fundamental. The 26-key limit partially includes
the last repeated-frequency family in each model.

Reproduce both assets with `.venv-shell/bin/python scripts/solve_sphere.py`, using
`scripts/requirements-shell.txt`. Shell matrices reuse the existing MITC4 kernel.
Validation includes 18/26 subdivisions per cube-face mesh, six rigid motions,
eigen residuals, mass orthogonality, radial participation, and comparison to
[Huang & Chen (1971), vacuum bending theory, Eq. 37b](https://repository.library.noaa.gov/view/noaa/34603/noaa_34603_DS1.pdf).
Finite mesh symmetry slightly splits ideal degeneracies; numerical modes are not
claimed to be exact individual spherical harmonics. Damping and visual envelopes
remain illustrative, with no fluid loading or acoustic radiation calculation.

### Performance recording

Record captures manual and MIDI driver weights and timing, including Sustain.
Playback and export recreate modal buildup and decay from those inputs; the
response envelope is not baked into the saved weights. Existing recordings
retain their saved strength curves as driver weights. Stop recording saves the latest nonempty take in localStorage;
replacement and discard require confirmation. Takes are limited to ten minutes
and finish when the page loses focus or becomes hidden. Storage failure leaves
the take available to download in the current session.

The recording panel supports Play/Pause/Resume, Stop, Export video, and Discard.
Playback can switch visualizations without stopping. Export video renders the
saved take silently into a 960 × 720, 30 fps video, independently of live playback.
It uses the current visualization, model, camera, exposure, pitch, and volume;
existing playback pauses while exporting. Progress and Cancel appear in the
recording panel. Rendering runs as fast as the device and visualization allow,
with no real-time replay requirement. Keep the page open; hiding the tab does not
cancel, though browsers may throttle background work. Cancel or a failed export
preserves the saved take. Download the completed file using the link that appears.

WebCodecs selects H.264/AAC in MP4 when available, otherwise VP9/Opus or VP8/Opus
in WebM. Unsupported browsers show an actionable error; there is no silent switch
back to real-time recording. Mediabunny is bundled locally and loaded on demand
(see `web/vendor/README.md` for its source and license). No server, CDN, microphone,
or screen-capture permission is involved. Run `npm run vendor:video` after changing
the pinned dependency. Desktop installers use the same bundled exporter.

Audio uses the live sine envelopes or modal solver, followed by the shared
compressor, limiter, and volume in OfflineAudioContext. The modal solver runs in
a worker that is terminated on cancellation. Native offline audio finishing is
discarded if cancelled. Visual frames have explicit timestamps; every recorded
event is applied before advancing, including taps shorter than one video frame.
Sand starts from a copy of the current grain positions and random state, advances
at 1/120-second steps, and leaves the live grains untouched. Takes store key events,
not original grain trajectories. A 0.6-second tail preserves note decay. Encoding
awaits backpressure rather than accumulating unencoded frames. PCM audio and the
compressed output remain in memory, so long takes need more RAM (roughly 115 MB
per ten-minute mono PCM buffer at 48 kHz, plus rendering and the encoded file).

The secondary Save replay file option downloads versioned `primeboard-performance`
JSON: timestamped integer `exponents` for Number and continuous `levels` for modal
views, ending with a silent frame. Version 2 keeps 32 weights per frame: 31
prefix inputs and the empty-set key, using the same final slot as earlier takes.
Existing version 1 takes with 26 weights remain playable. The six punctuation keys are used by Cantor and
ignored in the other views.
These files preserve timing rather than rendered
media; playback uses current model, camera, exposure, pitch, and volume settings.
Upload is not implemented.
