// Monospaced timecode clock. Renders a whole number of seconds as MM:SS with
// tabular figures so the digits don't jitter as the countdown ticks.

const format = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

interface TimecodeProps {
  seconds: number
  /** Final-minute styling: the clock turns red and pulses gently. */
  urgent?: boolean
}

export const Timecode = ({ seconds, urgent = false }: TimecodeProps): JSX.Element => (
  <span
    className={`timecode${urgent ? ' timecode--urgent' : ''}`}
    aria-label={`Time ${format(seconds)}`}
  >
    {format(seconds)}
  </span>
)
