// audio.js — all sound is synthesized: a two-oscillator engine hum tracking
// rpm, filtered wind noise tracking airspeed, a stall warbler and little
// chimes for rings, touchdowns and drops. U toggles mute.

export function createAudio() {
  let ctx = null;
  let master, engineOsc, engineOsc2, engineGain, windSrc, windGain, stallOsc, stallGain;
  let muted = false;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // engine: saw + sub sine through a lowpass
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sine';
    engineOsc2.frequency.value = 110;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(lp);
    engineOsc2.connect(lp);
    lp.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();

    // wind: looping filtered noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.4;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(bp);
    bp.connect(windGain);
    windGain.connect(master);
    windSrc.start();

    // stall horn
    stallOsc = ctx.createOscillator();
    stallOsc.type = 'square';
    stallOsc.frequency.value = 620;
    stallGain = ctx.createGain();
    stallGain.gain.value = 0;
    stallOsc.connect(stallGain);
    stallGain.connect(master);
    stallOsc.start();
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, slide) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    ensure,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setState(a, dt) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rpm = a.crashed ? 0 : a.rpm;
      engineOsc.frequency.setTargetAtTime(45 + rpm * 85, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(90 + rpm * 170, t, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + rpm * 0.12 + (a.onGround ? -0.02 : 0), t, 0.1);
      windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.16, (a.v / 120) * 0.18), t, 0.15);
      stallGain.gain.setTargetAtTime(!muted && a.stalled ? 0.05 : 0, t, 0.05);
      if (a.stalled) stallOsc.frequency.setValueAtTime(620 + Math.sin(t * 18) * 60, t);
    },
    beep(kind) {
      if (!ctx) return;
      if (kind === 'ring') {
        tone(880, 0.18, 'sine', 0.22);
        setTimeout(() => tone(1320, 0.22, 'sine', 0.2), 90);
      } else if (kind === 'good') {
        tone(660, 0.2, 'sine', 0.18);
        setTimeout(() => tone(990, 0.3, 'sine', 0.18), 120);
      } else if (kind === 'touch') {
        tone(90, 0.3, 'sine', 0.5, 45);
      } else if (kind === 'crash') {
        tone(60, 0.9, 'sawtooth', 0.5, 30);
      } else if (kind === 'drop') {
        tone(520, 0.4, 'sine', 0.15, 260);
      } else if (kind === 'warn') {
        tone(300, 0.25, 'square', 0.15);
      }
    },
  };
}
