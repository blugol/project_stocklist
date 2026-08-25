let ctx: AudioContext | null = null;

export function unlockAudio() {
  const audio = ctx ?? new AudioContext();
  ctx = audio;
  if (audio.state === "suspended") void audio.resume();
}

export function beep() {
  try {
    unlockAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.stop(now + 0.15);
  } catch {
    // autoplay blocked
  }
}
