// USB MIDI is an input address: each consecutive note selects one instrument
// slot. Pitches, per-key strengths and Cantor operations remain owned by the
// instrument; CC7 controls the overall output volume independently of notes.
export const MIDI_SETTINGS_KEY = 'primeboard-midi-v1';
export const MIDI_KEY_COUNT = 32;
const validFirstNote = value => Number.isInteger(value) && value >= 0 && value <= 128 - MIDI_KEY_COUNT;
async function closeInput(input) {
  try { await input.close(); } catch { /* An unplugged port may already be closed. */ }
}

export function midiNoteLabel(note) {
  const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1} (${note})`;
}

export class MidiController {
  constructor({ requestAccess, storage, onPress, onRelease, onVolume = () => {}, onChange = () => {}, canPlay = () => true }) {
    Object.assign(this, { requestAccess, storage, onPress, onRelease, onVolume, onChange, canPlay });
    this.access = null; this.input = null; this.failedInput = null; this.enabled = false; this.connecting = false;
    this.learning = false; this.firstNote = null; this.message = '';
    this.selectedId = ''; this.firstNotes = new Map(); this.storageWarning = false;
    this.active = new Map(); this.played = new Map(); this.pedals = new Set();
    this.generation = 0;
    this.onStateChange = () => this.refreshInputs();
    this.onMessage = event => { if (event.currentTarget === this.input) this.receive(event.data); };
    try {
      const saved = JSON.parse(storage?.getItem(MIDI_SETTINGS_KEY) || 'null');
      if (saved?.version === 1 && typeof saved.selectedId === 'string') {
        this.selectedId = saved.selectedId;
        for (const [id, value] of Object.entries(saved.firstNotes || {})) {
          if (validFirstNote(value)) this.firstNotes.set(id, value);
        }
      }
    } catch { /* A missing or damaged preference must not block connecting. */ }
  }
  get supported() { return typeof this.requestAccess === 'function'; }
  get inputs() { return [...(this.access?.inputs.values() || [])].filter(input => input.state === 'connected'); }
  get status() {
    if (this.connecting) return 'Waiting for MIDI permission…';
    if (this.message) return this.message;
    if (!this.enabled) return '';
    if (!this.input) return 'Waiting for a USB MIDI keyboard…';
    if (this.learning) return 'Press the leftmost key on your keyboard.';
    if (this.storageWarning) return 'Connected · calibration could not be saved in this browser.';
    return this.firstNote === null ? 'Set the first key to start playing.' : '';
  }
  save() {
    try {
      this.storage?.setItem(MIDI_SETTINGS_KEY, JSON.stringify({
        version: 1, selectedId: this.selectedId, firstNotes: Object.fromEntries(this.firstNotes),
      }));
      this.storageWarning = !this.storage;
    } catch { this.storageWarning = true; }
  }
  async connect() {
    if (!this.supported) {
      this.message = 'MIDI is unavailable in this browser. Use Chrome or Chromium over HTTPS or localhost.';
      this.onChange(); return;
    }
    if (this.connecting || this.enabled) return;
    const generation = ++this.generation;
    this.connecting = true; this.message = ''; this.onChange();
    try {
      const access = await this.requestAccess({ sysex: false });
      if (generation !== this.generation) return;
      this.access = access; this.enabled = true;
      access.addEventListener('statechange', this.onStateChange);
      const preferred = this.inputs.find(input => input.id === this.selectedId) || this.inputs[0];
      if (preferred) this.selectInput(preferred.id);
    } catch (error) {
      if (generation !== this.generation) return;
      this.message = ['NotAllowedError', 'SecurityError'].includes(error.name)
        ? 'MIDI access was denied. Allow it in the browser’s site settings, then reconnect.'
        : 'Could not connect to MIDI. Check the keyboard and try again.';
    } finally {
      if (generation === this.generation) { this.connecting = false; this.onChange(); }
    }
  }
  detachInput() {
    this.reset();
    if (this.input) {
      const old = this.input;
      old.removeEventListener('midimessage', this.onMessage);
      this.input = null;
      closeInput(old);
    }
  }
  disconnect() {
    ++this.generation;
    this.enabled = false; this.connecting = false;
    this.access?.removeEventListener('statechange', this.onStateChange);
    this.detachInput(); this.access = null; this.failedInput = null;
    this.learning = false; this.message = ''; this.onChange();
  }
  refreshInputs() {
    if (!this.enabled) return;
    if (this.failedInput?.state === 'disconnected') this.failedInput = null;
    if (this.input && !this.inputs.includes(this.input)) this.detachInput();
    if (!this.input) {
      const next = this.inputs.find(input => input.id === this.selectedId)
        || (!this.selectedId ? this.inputs[0] : null);
      if (next && next !== this.failedInput) this.selectInput(next.id);
    }
    this.onChange();
  }
  selectInput(id) {
    const input = this.inputs.find(candidate => candidate.id === id);
    if (!input || input === this.input) return;
    this.detachInput();
    this.input = input; this.failedInput = null; this.selectedId = id; this.message = '';
    this.firstNote = this.firstNotes.get(id) ?? null;
    this.learning = this.firstNote === null;
    input.addEventListener('midimessage', this.onMessage);
    (async () => {
      await input.open();
      if (this.input !== input) await closeInput(input);
    })().catch(() => {
      if (this.input !== input) return;
      this.failedInput = input;
      this.detachInput(); this.message = 'Could not open this keyboard. Disconnect and try again.'; this.onChange();
    });
    this.save(); this.onChange();
  }
  learn() {
    if (!this.input) return;
    this.reset(); this.message = ''; this.learning = true; this.onChange();
  }
  cancelLearn() { this.learning = false; this.message = ''; this.onChange(); }
  reset(channel) {
    for (const [source, voice] of this.played) {
      if (channel !== undefined && voice.channel !== channel) continue;
      this.onRelease(source, { force: true });
      this.played.delete(source); this.active.delete(source);
    }
    if (channel === undefined) this.pedals.clear();
    else this.pedals.delete(channel);
  }
  noteOff(source, channel) {
    const voice = this.active.get(source);
    if (!voice) return;
    if (this.pedals.has(channel)) {
      voice.down = false;
      this.onRelease(source, { sustain: true });
    } else {
      this.onRelease(source); this.active.delete(source);
    }
  }
  receive(data) {
    if (!this.enabled || !this.input || !data || data.length !== 3) return;
    const [status, note, value] = data;
    if (![status,note,value].every(Number.isInteger) || status < 0x80 || status > 0xef || note < 0 || note > 127 || value < 0 || value > 127) return;
    const command = status & 0xf0, channel = status & 0x0f;
    if (![0x80,0x90,0xb0].includes(command)) return;
    const source = `midi:${this.input.id}:${channel}:${note}`;
    if (command === 0x80 || (command === 0x90 && value === 0)) { this.noteOff(source, channel); return; }
    if (command === 0xb0) {
      // Volume must not use the note gate: adjusting a playing song should not
      // take over playback, and moving the knob must not calibrate a key.
      if (note === 7) { this.onVolume(value / 127); return; }
      if (note === 120) this.reset(channel);
      if (note === 123) for (const [id, voice] of this.active) if (voice.channel === channel) this.noteOff(id, channel);
      if (note === 64) {
        if (value >= 64 && this.canPlay() && !this.learning) this.pedals.add(channel);
        else if (value < 64) {
          this.pedals.delete(channel);
          for (const [id, voice] of this.active) if (voice.channel === channel && !voice.down) {
            this.onRelease(id); this.active.delete(id);
          }
        }
      }
      return;
    }
    if (this.learning) {
      if (!validFirstNote(note)) {
        this.message = 'Choose a first key at MIDI note 96 or below to leave room for 32 keys.';
      } else {
        this.firstNote = note; this.firstNotes.set(this.input.id, note);
        this.learning = false; this.message = ''; this.save();
      }
      this.onChange(); return; // Calibration does not sound or record a note.
    }
    if (this.firstNote === null || !this.canPlay() || this.active.get(source)?.down) return;
    const index = note - this.firstNote;
    if (index < 0 || index >= MIDI_KEY_COUNT) return;
    // Fixed strength preserves existing sound mappings; velocity is not retuning.
    if (!this.onPress(index, source)) return;
    const voice = { channel, down: true };
    this.active.set(source, voice); this.played.set(source, voice);
  }
}
