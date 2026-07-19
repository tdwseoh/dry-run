// Small shared presentational helpers used by both the landing and the in-app phases.

interface ErrorNoteProps {
  message: string
  onRetry: () => void
}

export const ErrorNote = ({ message, onRetry }: ErrorNoteProps): JSX.Element => (
  <div className="error-note" role="alert">
    <p className="error-headline">We lost the signal.</p>
    <p className="error-message">{message}</p>
    <button className="btn btn--ghost" onClick={onRetry}>
      Try again
    </button>
  </div>
)

export const LoadingDots = (): JSX.Element => (
  <div className="dots" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
)
