import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiController, MIDI_SETTINGS_KEY, midiNoteLabel } from '../web/midi.js';
import { Instrument, fitKeyWeights } from '../web/instrument.js';
import { cantorSelection, cantorAudioWeights } from '../web/cantor.js';
import { PerformanceRecorder, recordingSong } from '../web/recording.js';
import { songFrames } from '../web/song.js';
import { Synth } from '../web/audio.js';
import { setSoundVolume } from '../web/volume-control.js';

class Input extends EventTarget {
  constructor(id = 'keyboard') { super(); this.id = id; this.name = id; this.state = 'connected'; this.opens = 0; this.closes = 0; }
  async open() { this.opens++; }
  async close() { this.closes++; }
  send(...data) { const event = new Event('midimessage'); event.data = data; this.dispatchEvent(event); }
}
class Access extends EventTarget {
  constructor(inputs = [new Input()]) { super(); this.inputs = new Map(inputs.map(input => [input.id, input])); }
  change() { this.dispatchEvent(new Event('statechange')); }
}
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
async function rig({ access = new Access(), storage = memoryStorage(), count = 32, onVolume } = {}) {
  const instrument = new Instrument(32);
  let allowed = true, now = 0;
  const requests = [], volumes = [];
  const midi = new MidiController({
    requestAccess: async options => { requests.push(options); return access; }, storage,
    onPress: (index, source) => index < count && instrument.press(index, source, now),
    onRelease: (source, options) => instrument.release(source, options),
    onVolume: value => { volumes.push(value); onVolume?.(value); },
    canPlay: () => allowed,
  });
  await midi.connect();
  return { midi, access, instrument, requests, storage, volumes, input: midi.input,
    allow: value => { allowed = value; }, time: value => { now = value; },
    calibrate: (note = 48) => midi.input.send(0x90, note, 100),
  };
}

test('connection requests basic MIDI only, calibrates silently, and restores per-device settings', async () => {
  const r = await rig();
  assert.deepEqual(r.requests, [{ sysex: false }]);
  assert.equal(r.input.opens, 1); assert.equal(r.midi.learning, true);
  r.calibrate(36);
  assert.equal(r.midi.firstNote, 36); assert.equal(r.midi.learning, false);
  assert.ok(r.instrument.exponents.every(value => value === 0));
  assert.equal(midiNoteLabel(36), 'C2 (36)');
  r.midi.disconnect();
  const restored = await rig({ storage: r.storage });
  assert.equal(restored.midi.firstNote, 36); assert.equal(restored.midi.learning, false);
  restored.input.send(0x90, 36, 1);
  assert.equal(restored.instrument.exponents[0], 1);
  const second = new Input('second'); r.access.inputs.set(second.id, second);
  await r.midi.connect(); r.midi.selectInput('second'); r.calibrate(60);
  r.midi.selectInput('keyboard'); assert.equal(r.midi.firstNote, 36);
  r.midi.selectInput('second'); assert.equal(r.midi.firstNote, 60);
});

test('all 32 keys map in order; out-of-range notes and repeated note-ons do not add weights', async () => {
  const r = await rig(); r.calibrate(40);
  r.input.send(0x90,39,127); r.input.send(0x90,72,127);
  assert.ok(r.instrument.exponents.every(value => value === 0));
  for (let i=0;i<32;i++) r.input.send(0x90,40+i,i+1);
  assert.deepEqual(r.instrument.exponents, Array(32).fill(1));
  for (let i=0;i<32;i++) r.input.send(0x90,40+i,127);
  assert.deepEqual(r.instrument.exponents, Array(32).fill(1));
  for (let i=0;i<32;i++) r.input.send(i%2 ? 0x80 : 0x90,40+i,0);
  assert.ok(r.instrument.exponents.every(value => value === 0));
  assert.equal(r.instrument.sources.size, 0);
});

test('CC7 controls smoothed master volume across its full range and keeps the slider in sync', async () => {
  const synth = new Synth(), slider = { max: '50', value: '25' }, readout = { textContent: '25%' };
  const gainChanges = [];
  synth.context = { currentTime: 12 };
  synth.master = { gain: { setTargetAtTime: (...args) => gainChanges.push(args) } };
  synth.enabled = true;
  const r = await rig({ onVolume: value => setSoundVolume(synth, slider, readout, value * Number(slider.max) / 100) });
  r.calibrate(); r.input.send(0x90, 48, 100);
  const originalLevels = [...r.instrument.levels], originalWeights = [...r.instrument.exponents];
  for (let value = 0; value < 128; value++) {
    // Volume from any channel of the selected keyboard controls the master.
    r.input.send(0xb0 + value % 16, 7, value);
    assert.ok(Math.abs(synth.volume - value / 127 * 0.5) < 1e-15);
    assert.equal(slider.value, String(Math.round(value / 127 * 50)));
    assert.equal(readout.textContent, `${slider.value}%`);
    assert.deepEqual(gainChanges.at(-1), [synth.volume, 12, 0.02]);
  }
  assert.equal(r.volumes.length, 128);
  assert.equal(new Set(gainChanges.map(([gain]) => gain)).size, 128, 'keep MIDI resolution in the sound');
  assert.deepEqual(r.instrument.levels, originalLevels);
  assert.deepEqual(r.instrument.exponents, originalWeights);
  assert.equal(r.instrument.held.size, 1);
  setSoundVolume(synth, slider, readout, 0.2); // Manual slider can take over again.
  assert.equal(synth.volume, 0.2); assert.equal(slider.value, '20'); assert.equal(readout.textContent, '20%');
  synth.enabled = false; r.input.send(0xb0, 7, 127);
  assert.equal(synth.enabled, false, 'moving the knob must not unmute sound');
});

test('volume works during calibration and playback without running the live-note takeover gate', async () => {
  const r = await rig();
  r.midi.canPlay = () => { throw new Error('Volume must not take over a song'); };
  r.input.send(0xb0, 7, 64);
  assert.deepEqual(r.volumes, [64 / 127]);
  assert.equal(r.midi.learning, true); assert.equal(r.midi.firstNote, null);
  r.calibrate();
  r.midi.canPlay = () => false;
  r.input.send(0x90, 48, 100); r.input.send(0xb0, 7, 0);
  assert.deepEqual(r.volumes, [64 / 127, 0]);
  assert.ok(r.instrument.exponents.every(value => value === 0));
});

test('malformed volume data and unrelated MIDI controls cannot adjust the volume', async () => {
  const r = await rig(); r.calibrate();
  for (const data of [[0xb0, 7], [0xb0, 7, 0, 0], [0xb0, 7, -1], [0xb0, 7, 128],
    [0xb0, 7, NaN], [0xb0, 7, 63.5], [0xb0, 7.5, 50], [0x1b0, 7, 50],
    [0xe0, 7, 100], [0xb0, 1, 127], [0xb0, 39, 100], [0xb0, 11, 100], [0xf0, 7, 100]]) r.input.send(...data);
  assert.deepEqual(r.volumes, []);
  assert.ok(r.instrument.exponents.every(value => value === 0));
});

test('only the selected connected MIDI input can change volume', async () => {
  const a = new Input('a'), b = new Input('b'), r = await rig({ access: new Access([a, b]) });
  b.send(0xb0, 7, 127); assert.deepEqual(r.volumes, []);
  a.send(0xb0, 7, 0); assert.deepEqual(r.volumes, [0]);
  r.midi.selectInput('b');
  a.send(0xb0, 7, 127); assert.deepEqual(r.volumes, [0]);
  b.send(0xb0, 7, 127); assert.deepEqual(r.volumes, [0, 1]);
  b.state = 'disconnected'; r.access.change();
  b.send(0xb0, 7, 0); assert.deepEqual(r.volumes, [0, 1]);
  r.midi.disconnect(); r.midi.receive([0xb0, 7, 0]);
  assert.deepEqual(r.volumes, [0, 1]);
});

test('empty-set MIDI key absorbs intersections, is neutral in unions, and releases back to the held cylinder', async () => {
  const r = await rig(); r.calibrate();
  r.input.send(0x90,60,100); // index 12 = 101
  r.input.send(0x90,79,100); // index 31 = empty set
  assert.deepEqual(cantorSelection(r.instrument.exponents, 'intersection').result, []);
  assert.deepEqual(cantorSelection(r.instrument.exponents, 'union').result, ['101']);
  assert.ok(cantorAudioWeights(r.instrument.exponents, 'intersection').every(value => value === 0));
  r.input.send(0x80,79,0);
  assert.deepEqual(cantorSelection(r.instrument.exponents, 'intersection').result, ['101']);
  r.input.send(0x80,60,0); r.input.send(0x90,79,100);
  assert.equal(cantorSelection(r.instrument.exponents).kind, 'empty');
  assert.ok(cantorAudioWeights(r.instrument.exponents).every(value => value === 0));
});

test('MIDI channels and manual inputs own their releases independently', async () => {
  const r = await rig(); r.calibrate();
  r.instrument.press(0,'KeyQ',0);
  r.input.send(0x90,48,80); r.input.send(0x91,48,100);
  r.input.send(0x80,48,0); assert.equal(r.instrument.exponents[0],1);
  r.input.send(0x81,48,0); assert.equal(r.instrument.exponents[0],1);
  r.instrument.release('KeyQ'); assert.equal(r.instrument.exponents[0],0);
});

test('pedal sustain stops hold buildup, is channel-specific, and combines with manual sustain', async () => {
  const r = await rig(); r.calibrate();
  r.input.send(0xb0,64,127); r.input.send(0x90,48,100); r.input.send(0x91,49,100);
  r.instrument.tick(500);
  r.input.send(0x80,48,0); r.input.send(0x81,49,0);
  assert.equal(r.instrument.exponents[0],2); assert.equal(r.instrument.exponents[1],0);
  assert.equal(r.instrument.held.size,0);
  r.instrument.tick(10000);
  assert.equal(r.instrument.exponents[0],2); assert.equal(r.instrument.levels[0],1);
  r.instrument.setSustain(true); r.instrument.setSustain(false);
  assert.equal(r.instrument.exponents[0],2, 'Turning off manual sustain preserves the pedal.');
  r.input.send(0xb0,64,0); assert.equal(r.instrument.exponents[0],0);
  r.instrument.setSustain(true); r.input.send(0xb0,64,127);
  r.input.send(0x90,48,100); r.input.send(0x80,48,0); r.input.send(0xb0,64,0);
  assert.equal(r.instrument.exponents[0],1, 'Manual sustain remains when the pedal lifts.');
  r.instrument.setSustain(false); assert.equal(r.instrument.exponents[0],0);
});

test('disconnect clears held and sustained MIDI voices without clearing manual notes', async () => {
  const r = await rig(); r.calibrate(); r.instrument.setSustain(true);
  r.input.send(0x90,48,100); r.input.send(0x80,48,0);
  r.input.send(0x90,49,100);
  r.instrument.press(1,'KeyW',0);
  r.instrument.press(2,'KeyE',0); r.instrument.release('KeyE');
  r.input.state = 'disconnected'; r.access.change();
  assert.equal(r.midi.input,null);
  assert.deepEqual(r.instrument.exponents.slice(0,3),[0,1,1]);
  r.input.send(0x90,48,100); assert.equal(r.instrument.exponents[0],0);
  r.input.state = 'connected'; r.access.change();
  assert.equal(r.midi.input,r.input); assert.equal(r.midi.firstNote,48);
  r.input.send(0x90,48,100); assert.equal(r.instrument.exponents[0],1);
});

test('clear, view changes and playback gates cannot revive pedal-held or stale notes', async () => {
  const r = await rig(); r.calibrate();
  r.input.send(0xb0,64,127); r.input.send(0x90,48,100); r.input.send(0x80,48,0);
  r.midi.reset(); assert.equal(r.instrument.exponents[0],0);
  r.allow(false); r.input.send(0x90,48,100); r.input.send(0xb0,64,127);
  assert.equal(r.instrument.exponents[0],0); assert.equal(r.midi.pedals.size,0);
  r.allow(true); r.input.send(0x80,48,0); assert.equal(r.instrument.exponents[0],0);
  r.input.send(0x90,48,100); assert.equal(r.instrument.exponents[0],1);
  r.midi.reset(); r.midi.reset(); assert.equal(r.instrument.exponents[0],0);
});

test('MIDI cleanup preserves every key sustained by a pointer dragging across the keyboard', async () => {
  const r = await rig(); r.calibrate(); r.instrument.setSustain(true);
  for (const index of [0,1,2,0]) {
    r.instrument.press(index,'pointer-1',0); r.instrument.release('pointer-1');
  }
  assert.deepEqual(r.instrument.exponents.slice(0,3),[2,1,1]);
  for (const note of [48,49,50]) { r.input.send(0x90,note,100); r.input.send(0x80,note,0); }
  r.midi.disconnect();
  assert.deepEqual(r.instrument.exponents.slice(0,3),[3,2,2]);
  r.instrument.setSustain(false); assert.ok(r.instrument.exponents.every(value=>value===0));
  assert.equal(r.instrument.sustainedSources.size,0);
});

test('non-Cantor views accept only their 26 slots and keep punctuation silent', async () => {
  const r = await rig({count:26}); r.calibrate();
  for(let note=48;note<80;note++)r.input.send(0x90,note,100);
  assert.deepEqual(r.instrument.exponents, [...Array(26).fill(1),...Array(6).fill(0)]);
  assert.equal(r.midi.active.size,26);
  r.midi.disconnect(); assert.ok(r.instrument.exponents.every(value=>value===0));
});

test('all-notes-off honors the pedal; all-sound-off releases only its channel', async () => {
  const r = await rig(); r.calibrate();
  r.input.send(0xb0,64,127); r.input.send(0x90,48,100); r.input.send(0x91,49,100);
  r.input.send(0xb0,123,0); assert.equal(r.instrument.held.has(0),false); assert.equal(r.instrument.exponents[0],1);
  r.input.send(0xb0,120,0); assert.deepEqual(r.instrument.exponents.slice(0,2),[0,1]);
  r.input.send(0xb1,123,0); assert.ok(r.instrument.exponents.every(value=>value===0));
});

test('calibration validates the 32-note range, ignores note-off, and can be cancelled', async () => {
  const r = await rig();
  r.input.send(0x90,127,100); assert.equal(r.midi.firstNote,null); assert.equal(r.midi.learning,true);
  r.input.send(0x90,96,0); assert.equal(r.midi.learning,true);
  r.calibrate(96); r.input.send(0x90,127,100); assert.equal(r.instrument.exponents[31],1);
  r.midi.learn(); assert.ok(r.instrument.exponents.every(value=>value===0));
  r.midi.cancelLearn(); assert.equal(r.midi.firstNote,96);
  r.input.send(0x90,96,100); assert.equal(r.instrument.exponents[0],1);
});

test('invalid data, controller messages and SysEx cannot trigger notes', async () => {
  const r = await rig(); r.calibrate();
  for (const data of [[0x90,48], [0x90,48,128], [0x90,-1,100], [0x190,48,100], [-112,48,100],
    [0xe0,48,100], [0xb0,7,100], [0xa0,48,100], [0xf0,48,100], [0x90,48,NaN], [0x90,48.5,100]]) r.input.send(...data);
  assert.ok(r.instrument.exponents.every(value=>value===0));
});

test('permission failure and cancelled requests remain retryable without leaving listeners attached', async () => {
  const access = new Access(); let resolve, deny = true;
  const midi = new MidiController({
    requestAccess: () => deny ? Promise.reject({name:'NotAllowedError'}) : new Promise(done=>{resolve=done;}),
    onPress:()=>true,onRelease:()=>{},
  });
  await midi.connect(); assert.equal(midi.enabled,false); assert.match(midi.status,/denied/);
  deny=false; const pending=midi.connect(); midi.disconnect(); resolve(access); await pending;
  assert.equal(midi.enabled,false); assert.equal(midi.access,null); assert.equal(access.inputs.values().next().value.opens,0);
  const retry=midi.connect(); resolve(access); await retry; assert.equal(midi.enabled,true);
});

test('no-device connection discovers hotplug, and switching devices releases the previous input', async () => {
  const r = await rig({access:new Access([])});
  assert.equal(r.midi.input,null); assert.match(r.midi.status,/Waiting/);
  const a=new Input('a'),b=new Input('b');r.access.inputs.set(a.id,a);r.access.change();
  assert.equal(r.midi.input,a); r.calibrate(); a.send(0x90,48,100);
  r.access.inputs.set(b.id,b); r.access.change();r.midi.selectInput('b');
  assert.ok(r.instrument.exponents.every(value=>value===0)); assert.equal(r.midi.learning,true);
  a.send(0x90,49,100); assert.ok(r.instrument.exponents.every(value=>value===0));
});

test('unavailable MIDI and port-open failures report a recoverable status', async () => {
  const unsupported = new MidiController({onPress:()=>true,onRelease:()=>{}});
  assert.equal(unsupported.status,'', 'Browser guidance stays hidden until a connection is attempted.');
  await unsupported.connect(); assert.equal(unsupported.supported,false); assert.match(unsupported.status,/MIDI is unavailable/);
  const input = new Input(), access = new Access([input]);
  input.open = () => { input.opens++; throw Error('Port unavailable'); };
  input.close = async () => { input.closes++; access.change(); };
  const r = await rig({access});
  await new Promise(setImmediate);
  assert.equal(r.midi.input,null); assert.equal(input.opens,1); assert.match(r.midi.status,/Could not open/);
  access.change(); assert.equal(input.opens,1, 'A close event must not start an automatic retry loop.');
  input.open = async () => { input.opens++; };
  r.midi.selectInput(input.id); await new Promise(setImmediate);
  assert.equal(r.midi.input,input); assert.equal(input.opens,2);
  r.calibrate(); input.send(0x90,48,100); assert.equal(r.instrument.exponents[0],1);
});

test('damaged or unavailable preferences do not prevent playing', async () => {
  const storage=memoryStorage();storage.setItem(MIDI_SETTINGS_KEY,'{broken');
  const a=await rig({storage});a.calibrate();assert.equal(a.midi.firstNote,48);
  const b=await rig({storage:{getItem(){throw Error();},setItem(){throw Error();}}});b.calibrate();
  b.input.send(0x90,48,100); assert.equal(b.instrument.exponents[0],1);assert.match(b.midi.status,/could not be saved/);
});

test('MIDI performance and empty-set transitions survive recording and audio projection', async () => {
  const r=await rig();r.calibrate();const recorder=new PerformanceRecorder(32);recorder.start(0);
  const capture=time=>recorder.capture(time,r.instrument.exponents,r.instrument.levels);
  r.input.send(0x90,60,100);capture(0);
  r.input.send(0x90,79,100);capture(250);
  r.input.send(0x80,79,0);capture(500);
  r.input.send(0x80,60,0);capture(750);
  const frames=songFrames(recordingSong(recorder.finish(1000)));
  const projection=operation=>frames.map(frame=>cantorAudioWeights(fitKeyWeights(frame.exponents,32),operation));
  assert.deepEqual(projection('intersection').map(tones=>tones.reduce((a,b)=>a+b,0)),[1,0,1,0,0]);
  assert.deepEqual(projection('union').map(tones=>tones.reduce((a,b)=>a+b,0)),[1,1,1,0,0]);
});
