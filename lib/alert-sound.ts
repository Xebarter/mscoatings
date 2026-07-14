'use client';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Short two-tone chime for new admin alerts (no asset file required). */
export function playAlertChime(kind: 'message' | 'order' | 'both' = 'both') {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    void ctx.resume();

    const tones =
      kind === 'message'
        ? [784, 988]
        : kind === 'order'
          ? [523, 659, 784]
          : [523, 659, 784, 988];

    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  } catch {
    /* ignore autoplay / audio errors */
  }
}

export function isAlertsMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ms-admin-alerts-muted') === '1';
}

export function setAlertsMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ms-admin-alerts-muted', muted ? '1' : '0');
}
