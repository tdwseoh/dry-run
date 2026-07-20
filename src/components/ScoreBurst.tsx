// A one-shot particle burst behind the verdict score — fired only for a new
// personal best. Pure CSS animation on a handful of spans; the global
// reduced-motion rule suppresses it entirely.

const COLORS = ['var(--amber)', 'var(--mint)', 'var(--bone)', 'var(--red)']

export const ScoreBurst = (): JSX.Element => (
  <span className="burst" aria-hidden="true">
    {Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * 360 + (i % 3) * 7
      const distance = 70 + (i % 5) * 22
      return (
        <span
          key={i}
          className="burst-bit"
          style={{
            background: COLORS[i % COLORS.length],
            ['--angle' as string]: `${angle}deg`,
            ['--dist' as string]: `${distance}px`,
            animationDelay: `${(i % 6) * 40}ms`
          }}
        />
      )
    })}
  </span>
)
