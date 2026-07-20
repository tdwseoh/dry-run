import { Component, type ReactNode } from 'react'

import { DryRun } from './DryRun'

// Last-resort error boundary: if anything in the tree throws, show a styled
// in-voice recovery screen instead of a white page. State stays in
// localStorage, so reloading loses nothing but the current take.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('[dry-run] unrecoverable render error:', error)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="crash">
        <p className="crash-title">We lost the signal.</p>
        <p className="crash-sub">
          Something broke mid-broadcast. Your history and profile are safe —
          reload to get back on air.
        </p>
        <button
          className="btn btn--primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    )
  }
}

export default function App(): JSX.Element {
  return (
    <Boundary>
      <DryRun />
    </Boundary>
  )
}
