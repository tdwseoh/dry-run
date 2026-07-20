// Cinematic word-stagger for big titles. Splits the text into word spans with
// per-word delays; "auto" mode plays on mount (the hero), "reveal" mode waits
// for an ancestor `.reveal.is-visible` (section titles inside <Reveal>).
// Newlines in the text become <br/>.

interface SplitTitleProps {
  text: string
  mode?: 'auto' | 'reveal'
}

export const SplitTitle = ({
  text,
  mode = 'reveal'
}: SplitTitleProps): JSX.Element => {
  let wordIndex = 0
  const lines = text.split('\n')
  return (
    <span className={`split split--${mode}`}>
      {lines.map((line, li) => (
        <span className="split-line" key={li}>
          {li > 0 && <br />}
          {line.split(' ').map((word, wi) => {
            const delay = `${wordIndex++ * 90}ms`
            return (
              <span className="split-mask" key={wi}>
                <span
                  className="split-word"
                  style={{ transitionDelay: delay, animationDelay: delay }}
                >
                  {word}
                  {wi < line.split(' ').length - 1 ? ' ' : ''}
                </span>
              </span>
            )
          })}
        </span>
      ))}
    </span>
  )
}
