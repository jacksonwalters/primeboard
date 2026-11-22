import { VideoExport, videoExtension } from './video-export.js';
import { exportTimeline } from './export-timeline.js';
import { ExportRenderer } from './export-renderer.js';
import { PerformanceRecorder, RECORDING_KEY, MAX_SECONDS, validateRecording, recordingSong } from './recording.js';
import { loweredPitch, describePitch, matchesScale, NOTE_NAMES, SCALES } from './pitch.js';
import { updateSongButton } from './song-controls.js';
import { FUNDAMENTAL_HZ } from './resonator.js';
import { KEYS, MAX_EXPONENT, parseCMF, matchingAt, spectrumXYZ, primeProduct, displayColor, chromaticity } from './color.js';
import { Instrument, fitKeyWeights } from './instrument.js';
import { bindPointerKeyboard } from './pointer-keyboard.js';
import { bindVisualizationFullscreen } from './fullscreen.js';
import { Synth } from './audio.js';
import { setSoundVolume } from './volume-control.js';
import { shouldUnlockAudio } from './audio-gesture.js';
import { SONGS, SongPlayer, songSpectrum, songFrames } from './song.js';
import { MODES } from './plate-modes.js';
import { ModeDisplay } from './plate-display.js';
import { CubeView } from './cube-view.js';
import { CANTOR_KEYS, CANTOR_ROWS, CANTOR_STATE_SIZE, CANTOR_FREQUENCIES, DEFAULT_CANTOR_OPERATION, cantorAudioWeights, prefixLabel } from './cantor.js';
import { CantorView } from './cantor-view.js';
import { MidiController, midiNoteLabel } from './midi.js';

const $ = id => document.getElementById(id);
const instrument = new Instrument(CANTOR_STATE_SIZE);
const synth = new Synth();
// Sound is opted in initially; create/resume Web Audio during a user gesture.
synth.enabled = true;
const player = new SongPlayer(SONGS[0]);
const recorder = new PerformanceRecorder(CANTOR_STATE_SIZE);
let savedRecording = null;
let recordingNotice = '';
let videoExport = null;
let exportURL = null;
try { const raw=localStorage.getItem(RECORDING_KEY); if(raw) savedRecording=validateRecording(JSON.parse(raw)); }
catch { recordingNotice='Saved recording could not be read. You can make a new take.'; }
const codeMap = new Map(CANTOR_KEYS.map(key => [key.code, key.index]));
const svgNS = 'http://www.w3.org/2000/svg';
let rows, keyColors, keyButtons, spectrumLines;
let exposure = 1;
let currentNumber = '1';
let soundPending = false;
const copyTimers = new WeakMap();
let songPending = false;
let songError = '';
let playRequest = 0;
let cubeView;
let modesReady = false;
let visualization = 'cube';
let spherePitchOctaves = 0;
let cantorOperation = DEFAULT_CANTOR_OPERATION;
let scaleGuide = 'off', scaleRoot = 9, hoveredKey = null;
const sphereElastic = () => visualization === 'sphere' && cubeView?.model === 'elastic';
const surfaceView = view => view === 'cube' || view === 'sphere';
const tonalView = () => visualization === 'light' || visualization === 'cantor';
const viewWeights = weights => fitKeyWeights(weights, visualization === 'cantor' ? CANTOR_STATE_SIZE : KEYS.length);
const audioWeights = weights => visualization === 'cantor' ? cantorAudioWeights(weights, cantorOperation) : weights;
let cantorView;
let plateDisplay;
let midi;
const interaction = 'drive';
let animatePlate = !matchMedia('(prefers-reduced-motion: reduce)').matches;

function normalizedColor(xyz) {
  const largest = Math.max(...xyz);
  return displayColor(xyz.map(v => v / largest), 2).css;
}

function makeKeyboard() {
  keyColors = KEYS.map(key => normalizedColor(matchingAt(key.wavelength, rows)));
  keyButtons = [];
  for (const letters of CANTOR_ROWS) {
    const row = document.createElement('div'); row.className = 'key-row';
    for (const letter of letters) {
      const key = CANTOR_KEYS.find(k => k.letter === letter);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'key'; button.dataset.index = key.index;
      button.style.setProperty('--key-color', keyColors[key.index] || '#8cd5dd');
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<span class="key-letter">${letter}</span><span class="key-prime"></span><span class="key-note"></span><span class="key-pitch"></span><span class="key-exponent"></span>`;
      button.addEventListener('pointerenter', () => { hoveredKey = button; refreshPitchDetail(); });
      button.addEventListener('pointerleave', () => { hoveredKey = null; refreshPitchDetail(); });
      button.addEventListener('focus', refreshPitchDetail);
      button.addEventListener('blur', refreshPitchDetail);
      // Native Enter/Space or assistive-technology click: a short momentary note.
      // Pointer clicks have already been handled by the pointer-down/up path.
      button.addEventListener('click', event => {
        if (event.detail !== 0) return;
        const source = `accessible-${key.index}`;
        press(key.index, source);
        setTimeout(() => release(source), 180);
      });
      keyButtons[key.index] = button; row.append(button);
    }
    $('keyboard').append(row);
  }
  updateKeyboardLabels();
}

function keyFrequency(i, audible = true) {
  if (visualization === 'cantor') return CANTOR_FREQUENCIES[i];
  if (visualization === 'light') return KEYS[i]?.audioHz;
  const physicalSpec = visualization === 'modes' ? plateDisplay?.spec : cubeView?.spec;
  const spec = loweredPitch(physicalSpec, audible && sphereElastic() ? spherePitchOctaves : 0);
  return spec ? (spec.fundamentalHz ?? FUNDAMENTAL_HZ) * spec.ratios[i] : null;
}
function refreshPitchDetail() {
  const key = document.activeElement?.closest('.key') || hoveredKey;
  $('key-pitch-detail').textContent = key && !key.hidden ? key.dataset.pitchDetail || '' : '';
}
function configureResonator() {
  const spec = tonalView() ? null : visualization === 'modes' ? plateDisplay?.spec : cubeView?.spec;
  const audioSpec = loweredPitch(spec || null, sphereElastic() ? spherePitchOctaves : 0);
  const sand = visualization === 'modes' && $('plate-readout').value === 'sand';
  const changed = synth.setModel(audioSpec, interaction, visualization === 'cantor' ? CANTOR_FREQUENCIES : undefined);
  if (changed) {
    if (surfaceView(visualization) && cubeView && audioSpec) cubeView.setEnvelopeSpec(audioSpec);
    plateDisplay?.reset(); cubeView?.reset();
  }
  $('sphere-pitch-control').hidden = !sphereElastic();
  $('hold-speed').closest('label').hidden = visualization !== 'light';
  $('exposure').closest('label').hidden = visualization === 'cantor' || sand;
  if (changed && player.state === 'playing') {
    player.update(synth.context.currentTime);
    if (player.state === 'playing') scheduleSong();
  }
  return changed;
}
const surfaceModeLabel = i => 'φ' + String(i + 1).replace(/[0-9]/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
function keyModeLabel(i) {
  return visualization === 'modes' ? plateDisplay.modeLabel(i) : (cubeView?.data?.metadata.labels?.[i] || surfaceModeLabel(i));
}
function updateKeyboardLabels() {
  const modal = !tonalView(), cantor = visualization === 'cantor';
  const guided = scaleGuide !== 'off', scaleName = guided ? `${NOTE_NAMES[scaleRoot]} ${SCALES[scaleGuide].name}` : '';
  let matchingKeys = 0, knownPitches = 0;
  $('keyboard').classList.toggle('plate-keys', modal);
  $('keyboard').classList.toggle('cube-keys', surfaceView(visualization));
  $('keyboard').classList.toggle('cantor-keys', cantor);
  $('keyboard').classList.toggle('scale-guide-on', guided);
  $('scale-root-control').hidden = !guided;
  $('scale-summary').hidden = !guided;
  $('keyboard').setAttribute('aria-label', cantor ? `32 keys: 31 prefix cylinders and the empty set. Hold keys together to take their ${cantorOperation}.` : modal ? '26 eigenmodes. Type the matching QWERTY letters or play the connected MIDI keyboard.' : '26 primes. Type the matching QWERTY letters or play the connected MIDI keyboard.');
  keyButtons.forEach((button, i) => {
    button.hidden = !cantor && i >= KEYS.length;
    if (button.hidden) return;
    let identity, measurement = '';
    if (cantor) {
      const key = CANTOR_KEYS[i], prefix = key.prefix;
      if (prefix === null) {
        button.querySelector('.key-prime').textContent = '∅';
        button.querySelector('.key-note').textContent = '';
        button.querySelector('.key-pitch').textContent = 'empty set';
        button.classList.remove('scale-match');
        button.dataset.pitchDetail = '/ · empty set · no tone';
        button.title = '/ · empty set ∅ · Intersection becomes empty; Union is unchanged · no tone';
        button.setAttribute('aria-label', button.title);
        return;
      }
      button.querySelector('.key-prime').textContent = prefixLabel(prefix);
      button.querySelector('.key-note').textContent = '';
      identity = `${key.letter} · ${prefix ? `cylinder C(${prefix}), all continuations of ${prefix}` : 'empty prefix ∅, the whole Cantor set'}`;
    } else {
      const key = KEYS[i], label = keyModeLabel(i);
      button.querySelector('.key-prime').textContent = modal ? label : key.prime;
      const eigenvalue = surfaceView(visualization) ? cubeView?.data?.eigenvalues[i] : null;
      const detail = eigenvalue ? `λ = ${(cubeView.model === 'scalar' ? eigenvalue.toFixed(3) : eigenvalue.toExponential(2).replace('e+', 'e'))}` : '';
      measurement = detail;
      button.querySelector('.key-note').textContent = detail;
      identity = modal ? `${key.letter} · mode ${label}${detail ? ` · ${detail}` : ''}` : `${key.letter} · prime ${key.prime}`;
    }
    const pitch = describePitch(keyFrequency(i)), match = matchesScale(pitch, scaleRoot, scaleGuide);
    if (pitch) knownPitches++;
    if (match) matchingKeys++;
    button.classList.toggle('scale-match', match);
    button.querySelector('.key-pitch').textContent = pitch?.label || '—';
    const natural = sphereElastic() && spherePitchOctaves ? ` · natural ${Number(keyFrequency(i, false).toFixed(3))} Hz` : '';
    button.dataset.pitchDetail = `${CANTOR_KEYS[i].letter}${measurement ? ` · ${measurement}` : ''} · ${pitch?.detail || 'Loading pitch…'}${natural}`;
    button.title = `${identity} · ${pitch?.detail || 'Loading pitch…'}${natural}${guided && pitch ? ` · ${match ? 'matches' : 'outside'} ${scaleName} guide` : ''}`;
    button.setAttribute('aria-label', button.title);
  });
  $('scale-summary').textContent = knownPitches ? `${matchingKeys} matching ${matchingKeys === 1 ? 'key' : 'keys'}` : 'Loading pitches…';
  refreshPitchDetail();
}
function makeSpectrum() {
  const grid = $('spectrum-grid');
  for (const y of [16, 48, 80, 112]) {
    const line = document.createElementNS(svgNS, 'line');
    for (const [name, value] of Object.entries({ x1: 8, x2: 312, y1: y, y2: y, class: 'grid' })) line.setAttribute(name, value);
    grid.append(line);
  }
  const min = KEYS[0].frequencyTHz, max = KEYS.at(-1).frequencyTHz;
  spectrumLines = KEYS.map((key, i) => {
    const x = 8 + (key.frequencyTHz - min) / (max - min) * 304;
    const line = document.createElementNS(svgNS, 'line');
    for (const [name, value] of Object.entries({ x1: x, x2: x, y1: 112, y2: 112, stroke: keyColors[i], opacity: 0 })) line.setAttribute(name, value);
    $('spectrum-lines').append(line); return line;
  });
  $('spectrum-ramp').style.background = `linear-gradient(to right,${keyColors.map((c, i) => `${c} ${100 * (KEYS[i].frequencyTHz - min) / (max - min)}%`).join(',')})`;
}

function render() {
  const inSong = player.state === 'playing' || player.state === 'paused';
  const input = inSong ? songSpectrum(player.song, player.beat) : instrument.exponents;
  const modalInput = inSong ? songSpectrum(player.song, player.beat, true) : instrument.levels;
  const e = fitKeyWeights(input), modal = fitKeyWeights(modalInput);
  recorder.capture(performance.now(), instrument.exponents, instrument.levels);
  const shown = visualization === 'cantor' ? viewWeights(input) : tonalView() ? e : modal;
  const xyz = spectrumXYZ(e, rows);
  const color = displayColor(xyz, exposure);
  const xy = chromaticity(xyz);
  const active = e.filter(Boolean).length;
  const power = e.reduce((sum, value) => sum + value, 0);
  currentNumber = primeProduct(e).toString();
  const product = $('product');
  product.textContent = currentNumber;
  product.className = currentNumber.length > 22 ? 'long' : currentNumber.length > 10 ? 'medium' : '';
  $('factorization').innerHTML = active ? e.map((value, i) => value ? `${KEYS[i].prime}${value > 1 ? `<sup>${value}</sup>` : ''}` : '').filter(Boolean).join(' × ') : 'The empty product. The lights are off.';
  $('light-screen').style.setProperty('--light', color.css);
  $('light-field').classList.toggle('active', active > 0);
  $('color-hex').textContent = color.hex;
  $('color-chip').style.background = color.css;
  $('luminance').textContent = xyz[1].toFixed(4);
  $('luminance').title = `Unmodified XYZ: ${xyz.map(v => v.toFixed(6)).join(', ')}`;
  $('chromaticity').textContent = xy ? xy.map(v => v.toFixed(4)).join(', ') : '—';
  $('power').textContent = power;
  $('line-count').textContent = `${active} ${active === 1 ? 'LINE' : 'LINES'}`;
  $('gamut-note').textContent = `${color.outOfGamut ? 'Outside sRGB gamut · approximated' : 'sRGB preview'} · exposure compressed`;
  $('status').textContent = inSong ? `${player.state === 'playing' ? 'PLAYING' : 'PAUSED'} · ${player.song.title.toUpperCase()}` : shown.some(Boolean) ? (instrument.held.size ? 'PLAYING' : 'SUSTAINING') : 'READY TO PLAY';
  $('mixture-label').textContent = active ? `${active} ${active === 1 ? 'frequency' : 'frequencies'} · ${power} power ${power === 1 ? 'unit' : 'units'}${e.includes(MAX_EXPONENT) ? ' · hold limit 32' : ''}` : 'Press a key to begin';
  $('sustain').setAttribute('aria-pressed', String(instrument.sustain));
  $('sustain').querySelector('.button-state').textContent = instrument.sustain ? 'on' : 'off';
  $('copy').disabled = false;
  const peak = Math.max(4, ...e);
  $('spectrum-max').textContent = `${peak} power units`;
  shown.forEach((value, i) => {
    const button = keyButtons[i];
    if (!button) return;
    button.classList.toggle('active', value > 0);
    button.setAttribute('aria-pressed', String(value > 0));
    button.querySelector('.key-exponent').textContent = value > 0 && visualization === 'light' ? `^${value}` : '';
    spectrumLines[i]?.setAttribute('opacity', value ? 1 : 0);
    spectrumLines[i]?.setAttribute('y2', 112 - 96 * value / peak);
  });
  $('spectrum').setAttribute('aria-label', active ? `Relative spectral power, plot maximum ${peak} units: ${e.map((v, i) => v ? `${KEYS[i].frequencyTHz.toFixed(1)} terahertz at ${v} units` : '').filter(Boolean).join('; ')}` : 'No spectral lines active');
  if (visualization === 'modes') renderPlate(modal);
  if (visualization === 'cantor') cantorView.update(shown, cantorOperation);
  cubeView?.update(modal);
  refreshModeStrengths();
  if (modesReady) {
    const index = active === 1 ? e.findIndex(Boolean) : -1;
    const summary = index >= 0 ? `${keyModeLabel(index)} · ${describePitch(keyFrequency(index))?.detail || 'loading pitch'}` : `${active} active modes`;
    $('cube').setAttribute('aria-label', `${visualization === 'sphere' ? 'Sphere' : 'Rounded cube'}, ${summary}`);
  }
  if (!inSong && !videoExport) synth.sync(audioWeights(shown));
}

function refreshModeStrengths() {
  if (tonalView()) return;
  const view = visualization === 'modes' ? plateDisplay : cubeView;
  const bank = view?.bank;
  if (!bank) return;
  const response = view.displayState;
  bank.weights.forEach((weight, i) => {
    // A released key is immediately unpressed even while its vibration rings.
    keyButtons[i].querySelector('.key-exponent').textContent = weight > 0 ? `×${(response.q[i] ** 2).toFixed(1)}` : '';
  });
}

function selectView(view) {
  if (view !== visualization) midi?.reset();
  visualization = view;
  if (surfaceView(view) && modesReady && cubeView.shape !== view) cubeView.setModel(cubeView.model, view);
  configureResonator();
  const cube = surfaceView(view), modal = view === 'modes', cantor = view === 'cantor';
  for (const name of ['light', 'modes', 'cube', 'sphere', 'cantor']) $('view-' + name).setAttribute('aria-pressed', String(view === name));
  $('light-screen').classList.toggle('modes-active', cube);
  $('light-screen').hidden = modal || cantor; $('spectrum-panel').hidden = view !== 'light';
  $('plate-screen').hidden = !modal;
  $('cantor-screen').hidden = !cantor;
  $('cantor-options').hidden = !cantor;
  $('cube-options').hidden = !cube; $('cube-actions').hidden = !cube; $('plate-options').hidden = !modal; $('plate-actions').hidden = !modal;
  $('modes-view').hidden = !cube;
  $('light-field').hidden = cube;
  $('model-label').textContent = cantor ? 'CANTOR ALGEBRA · CYLINDER SETS' : cube ? (cubeView?.model === 'scalar' ? 'SCALAR SURFACE MODES' : (view === 'sphere' ? 'SPHERICAL SHELL MODES' : 'ROUNDED-CUBE SHELL MODES')) : modal ? 'SQUARE-PLATE EIGENMODES' : 'CIE 1931 · 2° OBSERVER';
  $('surface-name').textContent = view === 'sphere' ? 'SPHERE' : 'ROUNDED CUBE';
  $('cube-options').setAttribute('aria-label', view === 'sphere' ? 'Sphere model' : 'Cube model');
  cubeView?.setEnabled(cube);
  updateKeyboardLabels(); refreshSoundControls(); render();
  renderMidiControls();
}

function selectCantorOperation(operation) {
  if (operation === cantorOperation) return;
  cantorOperation = operation;
  for (const name of ['union', 'intersection']) $('cantor-' + name).setAttribute('aria-pressed', String(operation === name));
  $('cantor-operation-label').textContent = operation === 'union' ? 'UNION · ∪' : 'INTERSECTION · ∩';
  updateKeyboardLabels();
  if (player.state === 'playing') {
    player.update(synth.context.currentTime);
    if (player.state === 'playing') { scheduleSong(); return; }
  }
  render();
}

const readouts = {
  nodes: { title: 'COLORED NODES', description: 'Each driven eigenmode builds and fades in its own color. Multiple keys overlay their patterns.', legend: 'Each color traces one mode’s nodal lines.' },
  strength: { title: 'VIBRATION STRENGTH', description: 'Squared amplitude of the fading mode mixture, including interference. This is not mechanical energy.', legend: 'Dark: near zero displacement · bright: large displacement' },
  field: { title: 'MODE MIXTURE', description: 'The driven eigenmode envelopes added together, ringing down after release.', legend: 'Blue: positive displacement · orange: negative · black: zero' },
  sand: { title: 'SAND PARTICLES', legend: '' },
};
function renderPlate(e) {
  const readout = $('plate-readout').value;
  const info = readouts[readout];
  const sand = readout === 'sand';
  $('plate-screen-title').textContent = info.title;
  $('plate-screen').classList.toggle('sand-active', sand);
  $('plate-legend').textContent = info.legend;
  $('plate-legend').hidden = sand;
  $('plate-motion-controls').hidden = readout === 'nodes';
  $('plate-motion-note').hidden = sand;
  $('plate-sand-reset').hidden = !sand;
  $('plate-motion').textContent = animatePlate ? 'Freeze motion' : 'Animate';
  $('plate-motion').setAttribute('aria-pressed', String(!animatePlate));
  const active = e.flatMap((weight, i) => weight ? [{ i, weight }] : []);
  $('plate-empty').hidden = readout !== 'nodes' || active.length > 0 || plateDisplay.bank.energy > .0001;
  plateDisplay ??= new ModeDisplay($('plate-canvas'), rows);
  plateDisplay.setState(e, readout, exposure);
}

async function startFreePlate() {
  try {
    await plateDisplay.loadFreePlate();
    $('plate-free').disabled = false;
  } catch (error) { $('app-message').textContent = error.message; }
}
function selectPlateModel(model) {
  plateDisplay.setModel(model);
  const free = model === 'free';
  $('plate-supported').setAttribute('aria-pressed', String(!free));
  $('plate-free').setAttribute('aria-pressed', String(free));
  $('plate-material').textContent = free ? 'FREE ALUMINUM · 1 MM' : 'SIMPLY SUPPORTED';
  configureResonator(); updateKeyboardLabels(); render();
}

async function startModes() {
  const showError = message => {
    $('mode-message').textContent = message;
    document.querySelectorAll('[data-mode-control]').forEach(control => { control.disabled = Boolean(message); });
  };
  try {
    cubeView = new CubeView($('cube'), showError);
    cubeView.setEnabled($('view-cube').getAttribute('aria-pressed') === 'true');
    await cubeView.load();
    modesReady = true; showError('');
    $('view-sphere').disabled = false;
    $('cube-elastic').disabled = false; $('cube-scalar').disabled = false;
    cubeView.setInteraction(interaction);
    configureResonator(); updateKeyboardLabels();
    refreshMotionControl(); render();
  } catch (error) { showError(error.message); }
}
function selectCubeModel(model) {
  if (!modesReady || cubeView.model === model) return;
  cubeView.setModel(model);
  const scalar = model === 'scalar';
  $('cube-elastic').setAttribute('aria-pressed', String(!scalar));
  $('cube-scalar').setAttribute('aria-pressed', String(scalar));
  $('cube-material').textContent = scalar ? 'LAPLACE–BELTRAMI' : 'ALUMINUM · 1 MM SHELL';
  selectView(visualization);
}

function refreshMotionControl() {
  $('mode-pause').setAttribute('aria-pressed', String(cubeView.paused));
  $('mode-pause').textContent = cubeView.paused ? 'Resume motion' : 'Pause motion';
}

function press(index, source) {
  if (index >= KEYS.length && visualization !== 'cantor') return false;
  if (!takeOver()) return false;
  const pressed = instrument.press(index, source, performance.now());
  if (pressed) render();
  return pressed;
}
function release(source, options) { if (instrument.release(source, options)) render(); }
function clear() { midi?.reset(); instrument.clear(); plateDisplay?.reset(); cubeView?.reset(); if (player.state !== 'playing') synth.stop(); render(); }
function toggleSustain() { takeOver(); instrument.setSustain(!instrument.sustain); render(); }

function renderMidiControls() {
  if (!midi) return;
  $('midi-connect').textContent = midi.enabled || midi.connecting ? 'Disconnect' : 'Connect keyboard';
  $('midi-connect').disabled = false;
  const choices = midi.inputs.map(input => ({ id: input.id, label: input.name || input.manufacturer || 'MIDI keyboard' }));
  const signature = JSON.stringify(choices);
  const select = $('midi-input');
  if (select.dataset.choices !== signature) {
    select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select keyboard';
    select.append(placeholder);
    for (const { id, label } of choices) {
      const option = document.createElement('option'); option.value = id; option.textContent = label; select.append(option);
    }
    select.dataset.choices = signature;
  }
  select.value = midi.input?.id || '';
  $('midi-input-control').hidden = !midi.enabled || !choices.length;
  $('midi-learn').hidden = !midi.input;
  $('midi-learn').textContent = midi.learning ? 'Cancel calibration' : 'Set first key';
  $('midi-learn').setAttribute('aria-pressed', String(midi.learning));
  $('midi-range').hidden = !midi.input || midi.firstNote === null || midi.learning;
  const count = visualization === 'cantor' ? CANTOR_STATE_SIZE : KEYS.length;
  $('midi-range').textContent = midi.firstNote === null ? '' : `${count} keys · ${midiNoteLabel(midi.firstNote)}–${midiNoteLabel(midi.firstNote + count - 1)}`;
  $('midi-status').textContent = midi.status;
}

function bindMidi() {
  let storage;
  try { storage = localStorage; } catch { /* MIDI can still work without saved preferences. */ }
  midi = new MidiController({
    requestAccess: navigator.requestMIDIAccess?.bind(navigator), storage,
    onPress: press, onRelease: release, onChange: renderMidiControls,
    onVolume: value => {
      if (!document.hidden && document.hasFocus() && !videoExport) {
        setSoundVolume(synth, $('volume'), $('volume-value'), value * Number($('volume').max) / 100);
      }
    },
    canPlay: () => !document.hidden && document.hasFocus() && !videoExport && takeOver(),
  });
  $('midi-connect').addEventListener('click', async () => {
    if (midi.enabled || midi.connecting) { midi.disconnect(); return; }
    const connecting = midi.connect();
    // A MIDI message is not a browser user gesture. Unlock audio on this click.
    if (midi.supported && synth.enabled && !soundPending && !songPending) {
      soundPending = true;
      try { await synth.enable(); render(); }
      catch (error) { $('app-message').textContent = `Sound could not start: ${error.message}`; }
      finally { soundPending = false; refreshSoundControls(); }
    }
    await connecting;
  });
  $('midi-input').addEventListener('change', event => midi.selectInput(event.target.value));
  $('midi-learn').addEventListener('click', () => midi.learning ? midi.cancelLearn() : midi.learn());
  renderMidiControls();
}

function refreshSoundControls() {
  $('sound').setAttribute('aria-pressed', String(synth.enabled));
  $('sound').querySelector('.sound-label').textContent = synth.enabled ? 'Sound on' : 'Enable sound';

}
function renderSongControls() {
  renderRecordingControls();
  const time = beats => {
    const seconds = Math.floor(beats / player.beatsPerSecond);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  if(player.song.id==='recording') {
    updateSongButton($('song-play'),'idle',false);
    $('song-play').disabled=Boolean(recorder.active);
    $('song-stop').disabled=true;
    $('song-tempo').disabled=true;
    $('song-progress').value=0;
    $('song-status').textContent='Choose Play to start the library selection';
    $('song-time').textContent='';
    return;
  }
  $('song-tempo').disabled=Boolean(recorder.active);
  updateSongButton($('song-play'), player.state, songPending);
  $('song-play').disabled=songPending || Boolean(recorder.active);
  $('song-stop').disabled = player.state === 'idle' && !songPending;
  $('song-progress').max = player.song.beats;
  $('song-progress').value = player.beat;
  $('song-time').textContent = `${time(player.beat)} / ${time(player.song.beats)}`;
  $('song-status').textContent = songError || (songPending ? 'Starting audio…' : player.state === 'playing' ? `Playing · ${player.positionLabel}` : player.state === 'paused' ? 'Paused · press Resume to continue' : player.state === 'ended' ? 'Finished · play it again or try the keys' : 'Play to hear the song and watch its spectrum');
}
function renderSongSelection() {
  $('song-select').value = player.song.id;
  $('song-name').textContent = player.song.title;
  $('song-composer').textContent = player.song.composer;
  $('song-description').textContent = player.song.description;
  $('song-source').href = player.song.source;
  $('song-source').textContent = player.song.sourceLabel || 'Public-domain score ↗';
  for (const option of $('song-tempo').options) {
    const rate = Number(option.value);
    option.textContent = `${Math.round(player.song.bpm * rate)} BPM`;
  }
  renderSongControls();
}
function stopSong() {
  playRequest++;
  songPending = false;
  songError = '';
  player.stop(); synth.stopSequence(); renderSongControls();
}
function takeOver() {
  // Editing manual weights must not interrupt the song transport.
  if (player.state === 'playing' || player.state === 'paused' || songPending) return false;
  return true;
}
function pauseSong() {
  if (songPending) { stopSong(); return; }
  if (player.state !== 'playing') return;
  player.pause(synth.context.currentTime);
  synth.stopSequence(); renderSongControls(); render();
}
function scheduleSong() {
  const startAt = synth.context.currentTime + .03;
  player.play(startAt);
  const frames = songFrames(player.song, player.beat, !tonalView()).map(frame => ({ ...frame, exponents: audioWeights(viewWeights(frame.exponents)) }));
  synth.scheduleSequence(frames, startAt, player.beatsPerSecond);
  plateDisplay?.reset(); cubeView?.reset();
  renderSongControls(); render();
}
async function playSong() {
  if (player.state === 'playing') { pauseSong(); return; }
  if (songPending) return;
  const request = ++playRequest;
  songError = '';
  if (player.song.id === 'recording') recordingNotice = '';
  songPending = true; renderSongControls();
  try {
    await synth.enable();
    refreshSoundControls();
    if (request !== playRequest) return;
    midi?.reset();
    instrument.clear(); instrument.setSustain(false);
    $('app-message').textContent = '';
    scheduleSong();
  } catch (error) {
    if (request === playRequest) {
      songError = `Song could not start: ${error.message}`;
      if (player.song.id === 'recording') recordingNotice = songError;
      $('app-message').textContent = songError;
    }
  } finally {
    if (request === playRequest) { songPending = false; renderSongControls(); }
  }
}
function typingTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('textarea, select, [contenteditable="true"]')) return true;
  const input = target.closest('input');
  return Boolean(input && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(input.type));
}

function renderRecordingControls() {
  const recordingPlayback = player.song.id === 'recording';
  $('recording-panel').hidden = !savedRecording;
  const label=recorder.active ? '■ Stop recording' : '● Record';
  if($('record').textContent!==label)$('record').textContent=label;
  $('record').setAttribute('aria-pressed',String(Boolean(recorder.active)));
  $('record-clock').hidden=!recorder.active;
  if(recorder.active)$('record-clock').textContent=recordingTime((performance.now()-recorder.started)/1000);
  if(savedRecording)$('recording-info').textContent=`${recordingTime(savedRecording.duration)}`;
  updateSongButton($('recording-play'),recordingPlayback?player.state:'idle',recordingPlayback&&songPending);
  $('recording-play').disabled=recorder.active || (recordingPlayback&&songPending);
  $('recording-stop').disabled=!recordingPlayback || !['playing','paused'].includes(player.state);
  $('recording-discard').disabled=recorder.active;
  $('recording-status').textContent=recordingNotice || (recordingPlayback&&['playing','paused'].includes(player.state)?`${player.state==='playing'?'Playing':'Paused'} · ${recordingTime(player.beat)}`:'Saved in this browser. Export video to share.');
  $('song-select').disabled=recorder.active;
  $('song-restart').disabled=recorder.active;
  const exporting=Boolean(videoExport);
  $('export-progress').hidden=!exporting;
  $('record').disabled=exporting;
  $('recording-export').disabled=Boolean(recorder.active)||exporting;
  $('export-cancel').hidden=!exporting;
  for(const id of ['recording-play','recording-stop','recording-discard','recording-download'])if(exporting)$(id).disabled=true;
  if(!exporting)$('recording-download').disabled=false;
}
function recordingTime(seconds) { const n=Math.floor(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
function finishRecording() {
  if(!recorder.active)return;
  const take=recorder.finish(performance.now());
  if(take) {
    clearExportDownload();
    savedRecording=take;
    try { localStorage.setItem(RECORDING_KEY,JSON.stringify(take));recordingNotice=''; }
    catch { recordingNotice='Browser storage is unavailable or full. Export or save this take before leaving.'; }
  } else recordingNotice='No notes recorded. Your previous take was kept.';
  clear(); renderSongControls();
}
function downloadRecording() {
  if(!savedRecording)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(savedRecording)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='primeboard-performance.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function clearExportDownload() {
  if(exportURL)URL.revokeObjectURL(exportURL);
  exportURL=null;$('export-result').hidden=true;$('export-result').removeAttribute('href');
}
function finishVideoExport() {
  videoExport=null;
  document.querySelector('.instrument-settings').inert=false;
  document.querySelector('.below-instrument').inert=false;
  $('keyboard').inert=false;
  renderRecordingControls();
}
function cancelVideoExport() {
  if(!videoExport)return;
  videoExport.cancel();
  recordingNotice='Cancelling export…';renderRecordingControls();
}
async function exportRecordingVideo() {
  if(!savedRecording||recorder.active||videoExport)return;
  clearExportDownload();
  const job = new VideoExport(); videoExport=job;
  $('export-progress').value=0;
  recordingNotice='Preparing video…';renderRecordingControls();
  document.querySelector('.instrument-settings').inert=true;
  document.querySelector('.below-instrument').inert=true;$('keyboard').inert=true;
  try {
    // Pause existing sound, but do not select or play the recording to export it.
    pauseSong(); synth.stop();
    const timeline=exportTimeline(savedRecording,visualization,cantorOperation);
    const blob=await job.run({
      timeline,
      audioSettings: { spec:synth.model, interaction:synth.interaction, frequencies:[...synth.frequencies], volume:synth.volume },
      createRenderer: () => new ExportRenderer({view:visualization,rows,exposure,operation:cantorOperation,cubeView,plateDisplay}),
      onProgress: (stage, progress) => {
        if(job.controller.signal.aborted)return;
        recordingNotice=`${stage} · ${Math.round(progress*100)}%`;
        $('export-progress').value=progress;renderRecordingControls();
      },
    });
    exportURL=URL.createObjectURL(blob);
    const link=$('export-result');link.href=exportURL;link.download=`primeboard-recording.${videoExtension(blob.type)}`;link.hidden=false;
    link.textContent=`Download video (${videoExtension(blob.type).toUpperCase()})`;
    recordingNotice='Video ready.';
  } catch(error) {
    recordingNotice=job.controller.signal.aborted ? 'Export cancelled. Your recording is still saved.'
      : `Could not export video: ${error.message} Your recording is still saved.`;
  } finally { finishVideoExport(); }
}

function bindInputs() {
  $('recording-export').addEventListener('click',exportRecordingVideo);
  $('export-cancel').addEventListener('click',cancelVideoExport);
  $('record').addEventListener('click',()=>{
    if(recorder.active){finishRecording();return;}
    if(savedRecording && !window.confirm('Replace your saved take? Choose Cancel to export it or save a replay file first.'))return;
    stopSong(); midi?.reset(); instrument.clear(); instrument.setSustain(false);
    recorder.start(performance.now());recordingNotice='';render();renderSongControls();
  });
  $('recording-download').addEventListener('click',downloadRecording);
  $('recording-play').addEventListener('click',()=>{
    if(!savedRecording||recorder.active)return;
    if(player.song.id!=='recording'){stopSong();player.selectSong(recordingSong(savedRecording));player.rate=1;}
    playSong();
  });
  $('recording-stop').addEventListener('click',()=>{stopSong();clear();});
  $('recording-discard').addEventListener('click',()=>{
    if(!window.confirm('Discard this recording? Export it or save a replay file first if you want to keep it.'))return;
    if(player.song.id==='recording'){stopSong();player.selectSong(SONGS.find(s=>s.id===$('song-select').value)||SONGS[0]);clear();}
    clearExportDownload();
    savedRecording=null;try{localStorage.removeItem(RECORDING_KEY);}catch{}
    recordingNotice='';renderSongControls();
  });
  let unlockRequest = 0;
  const unlockSound = async event => {
    if (!shouldUnlockAudio(event) || !synth.enabled || soundPending || songPending
        || (synth.context?.state === 'running' && synth.resonatorNode) || videoExport) return;
    const request = ++unlockRequest;
    try {
      await synth.enable();
      if (request === unlockRequest) render();
    } catch (error) {
      if (request === unlockRequest && !songPending && (!synth.resonatorNode || synth.context?.state !== 'running')) {
        $('app-message').textContent = `Sound could not start: ${error.message}`;
      }
    }
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, unlockSound, { capture: true, passive: true });
  }
  const revealSection = hash => {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const details = target.closest('details');
    if (details) details.open = true;
    return target;
  };
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    revealSection(link.getAttribute('href'));
  }));
  window.addEventListener('hashchange', () => revealSection(location.hash)?.scrollIntoView());
  if (location.hash) requestAnimationFrame(() => revealSection(location.hash)?.scrollIntoView());
  $('view-cube').addEventListener('click', () => selectView('cube'));
  $('view-sphere').addEventListener('click', () => selectView('sphere'));
  $('sphere-pitch').addEventListener('change', event => {
    spherePitchOctaves = Number(event.target.value);
    configureResonator(); updateKeyboardLabels(); render();
  });
  $('scale-guide').addEventListener('change', event => { scaleGuide = event.target.value; updateKeyboardLabels(); });
  $('scale-root').addEventListener('change', event => { scaleRoot = Number(event.target.value); updateKeyboardLabels(); });
  for (const model of ['elastic', 'scalar']) $('cube-' + model).addEventListener('click', () => selectCubeModel(model));
  $('view-light').addEventListener('click', () => selectView('light'));
  $('view-modes').addEventListener('click', () => selectView('modes'));
  $('view-cantor').addEventListener('click', () => selectView('cantor'));
  for (const operation of ['union', 'intersection']) $('cantor-' + operation).addEventListener('click', () => selectCantorOperation(operation));
  for (const model of ['supported', 'free']) $('plate-' + model).addEventListener('click', () => selectPlateModel(model));
  $('mode-pause').addEventListener('click', () => {
    cubeView.setPaused(!cubeView.paused); refreshMotionControl();
  });
  $('mode-reset').addEventListener('click', () => cubeView.resetCamera());
  $('mode-save').addEventListener('click', () => cubeView.saveImage(currentNumber));
  const fullscreen = bindVisualizationFullscreen($('visualization-stage'), $('visualization-fullscreen'), $('fullscreen-keyboard'));
  window.addEventListener('keydown', event => {
    if (fullscreen.handleEscape(event)) return;
    if(videoExport)return;
    if (event.code === 'Escape') { if (!event.repeat) clear(); return; }
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || typingTarget(event.target)) return;
    if (event.code === 'Space' && !event.target.closest('button, summary, a')) {
      event.preventDefault(); if (!event.repeat) toggleSustain(); return;
    }
    const index = codeMap.get(event.code);
    if (index === undefined || (index >= KEYS.length && visualization !== 'cantor')) return;
    event.preventDefault(); if (!event.repeat) press(index, event.code);
  });
  window.addEventListener('keyup', event => release(event.code));

  const pointerKeyboard = bindPointerKeyboard($('keyboard'), { onPress: press, onRelease: release });
  const stop = () => {
    if(recorder.active)finishRecording();
    pointerKeyboard.reset(); midi?.reset(); instrument.clear();
    plateDisplay?.reset(); cubeView?.reset();
    if (player.state !== 'playing') synth.stop();
    render();
  };
  window.addEventListener('blur', () => fullscreen.handleBlur(stop));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', () => { cancelVideoExport(); stop(); });
  $('plate-readout').addEventListener('change', () => { configureResonator(); render(); $('keyboard').focus({ preventScroll: true }); });
  $('plate-sand-reset').addEventListener('click', () => { plateDisplay.redistributeSand(); $('keyboard').focus({ preventScroll: true }); });
  $('plate-motion').addEventListener('click', () => { animatePlate = !animatePlate; render(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches) { animatePlate = false; render(); } });
  const modalPresets = { single: [[8,2]], pair: [[4,2],[8,2]], chord: [[4,2],[8,2],[13,2]] };
  document.querySelectorAll('[data-plate-preset]').forEach(button => button.addEventListener('click', () => {
    if (!takeOver()) return; const weights = KEYS.map(() => 0);
    for (const [i,e] of modalPresets[button.dataset.platePreset]) weights[i] = e;
    midi?.reset(); instrument.load(fitKeyWeights(weights, CANTOR_STATE_SIZE)); render();
  }));
  $('clear').addEventListener('click', clear);
  $('sustain').addEventListener('click', toggleSustain);
  $('sound').addEventListener('click', async () => {
    if (soundPending || songPending) return;
    soundPending = true;
    try {
      if (synth.enabled) synth.disable();
      else {
        await synth.enable();
        if (player.state === 'playing') {
          player.update(synth.context.currentTime);
          if (player.state === 'playing') scheduleSong();
        }
      }
      refreshSoundControls();
      $('app-message').textContent = '';
      render();
      $('keyboard').focus({ preventScroll: true });
    } catch (error) { $('app-message').textContent = `Sound could not start: ${error.message}`; }
    finally { soundPending = false; }
  });
  $('song-play').addEventListener('click', () => {
    if(recorder.active)return;
    if(player.song.id==='recording'){stopSong();player.selectSong(SONGS.find(s=>s.id===$('song-select').value)||SONGS[0]);player.rate=Number($('song-tempo').value);}
    playSong();
  });
  $('song-select').addEventListener('change', event => {
    const song = SONGS.find(song => song.id === event.target.value);
    if (!song) return;
    const wasPlaying = player.state === 'playing';
    stopSong(); midi?.reset(); instrument.clear();
    player.selectSong(song);
    player.rate=Number($('song-tempo').value);
    if (song.view) {
      selectCantorOperation(song.operation);
      selectView(song.view);
    }
    if (wasPlaying) playSong();
    $('app-message').textContent = '';
    renderSongSelection(); render();
  });
  $('song-stop').addEventListener('click', () => { stopSong(); clear(); });
  $('song-restart').addEventListener('click', () => { if(recorder.active)return;stopSong();player.selectSong(SONGS.find(s=>s.id===$('song-select').value)||SONGS[0]); player.rate=Number($('song-tempo').value); clear(); playSong(); });
  $('song-tempo').addEventListener('change', event => {
    const playing = player.state === 'playing';
    const now = synth.context?.currentTime || 0;
    player.setRate(Number(event.target.value), now);
    if (playing && player.state === 'playing') scheduleSong();
    else { renderSongControls(); render(); }
  });
  $('exposure').addEventListener('input', event => {
    exposure = 2 ** Number(event.target.value);
    $('exposure-value').textContent = `${exposure.toFixed(1)}×`; render();
  });
  $('hold-speed').addEventListener('input', event => {
    const ms = Number(event.target.value);
    instrument.setHoldMs(ms, performance.now()); $('hold-value').textContent = `${(ms / 1000).toFixed(2)} s`;
  });
  $('volume').addEventListener('input', event => {
    setSoundVolume(synth, $('volume'), $('volume-value'), Number(event.target.value) / 100);
  });
  for (const id of ['copy']) {
    const button = $(id);
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentNumber);
        button.textContent = 'Copied ✓';
        clearTimeout(copyTimers.get(button));
        copyTimers.set(button, setTimeout(() => { button.textContent = 'Copy number ↗'; }, 1800));
      } catch { $('app-message').textContent = 'Copy is unavailable in this browser. Select the number on the screen to copy it.'; }
    });
  }
  // Discrete real-time steps, independent of browser/OS key-repeat settings.
  setInterval(() => { if (visualization === 'light' && instrument.tick(performance.now())) render(); }, 25);
  let lastSongSpectrum = '';
  let lastStrengthRender = 0;
  const animateSong = timestamp => {
    if(recorder.active) {
      if(timestamp-recorder.started>=MAX_SECONDS*1000)finishRecording();
      else renderRecordingControls();
    }
    if (player.state === 'playing') {
      player.update(synth.context.currentTime);
      const spectrum = songSpectrum(player.song, player.beat, !tonalView()).join(',');
      if (spectrum !== lastSongSpectrum || player.state === 'ended') {
        lastSongSpectrum = spectrum; render();
      }
      renderSongControls();
    }
    plateDisplay?.tick(timestamp, visualization === 'modes' && animatePlate && player.state !== 'paused' && !document.hidden);
    if (cubeView) {
      cubeView.transportPaused = player.state === 'paused';
      cubeView.tick(timestamp);
    }
    if (!tonalView() && timestamp - lastStrengthRender >= 1000 / 30) {
      lastStrengthRender = timestamp; refreshModeStrengths();
    }
    requestAnimationFrame(animateSong);
  };
  requestAnimationFrame(animateSong);
}

async function start() {
  try {
    const response = await fetch(new URL('./data/CIE_xyz_1931_2deg.csv', import.meta.url));
    if (!response.ok) throw new Error(`Color data request returned ${response.status}.`);
    rows = parseCMF(await response.text());
    plateDisplay = new ModeDisplay($('plate-canvas'), rows);
    cantorView = new CantorView($('cantor-canvas'));
    startFreePlate();
    makeKeyboard(); makeSpectrum();
    for (const song of SONGS) {
      const option = document.createElement('option');
      option.value = song.id; option.textContent = `${song.title} — ${song.composer}`;
      $('song-select').append(option);
    }
    bindInputs(); refreshSoundControls();
    document.querySelectorAll('button[disabled]:not([data-mode-control])').forEach(button => { button.disabled = false; });
    bindMidi();
    $('song-tempo').disabled = false; $('song-select').disabled = false; renderSongSelection();
    renderRecordingControls();
    $('status-dot').classList.add('ready'); $('app-message').textContent = ''; render();
    startModes();
  } catch (error) {
    $('status').textContent = 'COULD NOT LOAD';
    $('app-message').textContent = `Primeboard could not start: ${error.message} Please reload to try again.`;
  }
}
start();
