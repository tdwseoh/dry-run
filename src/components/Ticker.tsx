// Infinite marquee strip — event codes and broadcast phrases drifting across
// the page between sections. Content is duplicated once so the CSS loop is
// seamless; the animation pauses on hover and dies under reduced motion.

const ITEMS = [
  'PBM',
  '10:00 PREP',
  'HTDM',
  'ON AIR',
  'PMK',
  'PERFORMANCE INDICATORS',
  'FTDM',
  'THE VERDICT',
  'PFN',
  'STANDBY',
  'MTDM',
  'Q&A',
  'PHT',
  'ICDC READY',
  'BLTDM',
  'NEW PERSONAL BEST',
  'HRM'
]

export const Ticker = (): JSX.Element => {
  const run = ITEMS.map((item, i) => (
    <span className="ticker-item" key={i}>
      {item}
      <span className="ticker-dot" aria-hidden="true">
        ●
      </span>
    </span>
  ))
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {run}
        {run}
      </div>
    </div>
  )
}
