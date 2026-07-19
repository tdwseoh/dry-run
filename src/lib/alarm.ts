// Time-up alarm, synthesized with the Web Audio API — no audio assets to load.
//
// Browsers only allow sound after a user gesture, so primeAlarm() must be called
// from a click handler (starting a run) to create/resume the shared AudioContext.
// playAlarm() can then fire later from a timer. Every call is failure-safe: a
// browser that refuses audio never breaks the run — the alarm is just silent.

let ctx: AudioContext | null = null

/** Create/resume the audio context. Call from a user gesture (button click). */
export const primeAlarm = (): void => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** One enveloped sine beep at `freq` Hz, starting `at` seconds from now. */
const beep = (
  audio: AudioContext,
  freq: number,
  at: number,
  duration: number
): void => {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  // Quick attack, exponential release — avoids clicks at both ends.
  const t0 = audio.currentTime + at
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

export type AlarmKind = 'standby-over' | 'time-up'

/**
 * Ring the alarm. 'standby-over' (prep expired, you're going on air) is three
 * rising beeps; 'time-up' (presentation over) is two long low ones.
 */
export const playAlarm = (kind: AlarmKind): void => {
  if (!ctx) return
  try {
    if (kind === 'standby-over') {
      beep(ctx, 660, 0, 0.18)
      beep(ctx, 880, 0.24, 0.18)
      beep(ctx, 1100, 0.48, 0.3)
    } else {
      beep(ctx, 520, 0, 0.4)
      beep(ctx, 390, 0.5, 0.6)
    }
  } catch {
    // Audio unavailable — stay silent rather than break the phase change.
  }
}
