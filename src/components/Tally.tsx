// The signature broadcast tally light. Amber steady = STANDBY (prep), red pulsing =
// ON AIR (present), grey = OFF. The pulse is CSS-driven and is killed by the
// prefers-reduced-motion rule in index.css.

export type TallyMode = 'off' | 'standby' | 'onair'

const LABELS: Record<TallyMode, string> = {
  off: 'OFF',
  standby: 'STANDBY',
  onair: 'ON AIR'
}

interface TallyProps {
  mode: TallyMode
}

export const Tally = ({ mode }: TallyProps): JSX.Element => (
  <div
    className={`tally tally--${mode}`}
    role="status"
    aria-label={`Camera status: ${LABELS[mode]}`}
  >
    <span className="tally-dot" aria-hidden="true" />
    <span className="tally-label">{LABELS[mode]}</span>
  </div>
)
