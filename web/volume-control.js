// Both the on-screen slider and MIDI knob control the same smoothed master gain.
export function setSoundVolume(synth, slider, readout, volume) {
  synth.setVolume(volume);
  // Preserve MIDI's full resolution in the audio, rounding only the displayed %.
  const percent = Math.round(synth.volume * 100);
  slider.value = String(percent);
  readout.textContent = `${percent}%`;
}
