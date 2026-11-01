// A quiet, synthesized nocturne. No downloads and no audio before interaction.
export function createAudio() {
  let context, master, enabled = false;
  function init() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    [130.81, 196, 261.63, 293.66].forEach((frequency, i) => {
      const tone = context.createOscillator(); tone.type = 'sine'; tone.frequency.value = frequency;
      const gain = context.createGain(); gain.gain.value = i === 3 ? 0.008 : 0.015;
      const wave = context.createOscillator(); wave.frequency.value = 0.06 + i * 0.017;
      const depth = context.createGain(); depth.gain.value = 0.005;
      wave.connect(depth); depth.connect(gain.gain); tone.connect(gain); gain.connect(master); tone.start(); wave.start();
    });
  }
  return {
    toggle() { init(); if (!context) return false; enabled = !enabled; context.resume(); master.gain.setTargetAtTime(enabled ? 0.55 : 0, context.currentTime, 0.4); return enabled; },
    found() {
      if (!context || !enabled) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
        const t = context.currentTime + i * 0.11;
        const tone = context.createOscillator(), gain = context.createGain();
        tone.type = 'sine'; tone.frequency.value = frequency; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.13, t + 0.025); gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        tone.connect(gain); gain.connect(master); tone.start(t); tone.stop(t + 1.3);
      });
    }
  };
}
