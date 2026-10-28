/**
 * A two-note chime made with the Web Audio API, so there is no audio file to host.
 * Browsers only allow sound after the person has tapped the page once; `unlockAudio` is called from that first tap.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a click / key / touch handler. Resolves true once sound is allowed. */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
  } catch {
    /* still locked */
  }
  return c.state === 'running';
}

export function audioReady(): boolean {
  return ctx?.state === 'running';
}

export function audioSupported(): boolean {
  return getCtx() !== null;
}

/** Returns false when the browser still has sound locked. */
export function playChime(): boolean {
  const c = getCtx();
  if (!c || c.state !== 'running') return false;
  const t0 = c.currentTime;
  [
    { f: 880, at: 0 },
    { f: 1175, at: 0.18 },
    { f: 880, at: 0.5 },
    { f: 1175, at: 0.68 },
  ].forEach(({ f, at }) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.28);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.3);
  });
  return true;
}
