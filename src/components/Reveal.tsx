import { useEffect, useRef, useState, type ReactNode } from 'react'

// Reveal-on-scroll wrapper. Starts hidden (offset + faded) and transitions in the
// first time it scrolls into view, via IntersectionObserver — the lightweight,
// dependency-free way to get the Apple-style "content animates up as you scroll"
// feel. Reduced-motion users get the content immediately (handled in index.css).

interface RevealProps {
  children: ReactNode
  /** Stagger this element's entrance by N milliseconds. */
  delay?: number
  className?: string
}

export const Reveal = ({
  children,
  delay = 0,
  className = ''
}: RevealProps): JSX.Element => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // If IntersectionObserver is unavailable, don't hide content — show it.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target) // reveal once, then stop watching
          }
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
