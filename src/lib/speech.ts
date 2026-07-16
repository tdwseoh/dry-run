// Web Speech API wrapper.
//
// The browser's SpeechRecognition is not in the standard TypeScript DOM lib, so we
// declare a minimal slice of it below. The public surface is tiny on purpose:
//   - isSpeechSupported(): decide up front whether to show the typed fallback.
//   - startSpeech(handlers): begin listening; returns a stop() handle (or null if
//     it could not start, in which case onError already fired).
//
// Quirk handled here: Chrome ends a recognition session after a pause even with
// continuous = true. We restart it on `end` until the caller stops us, so a
// student who pauses to think does not silently lose the mic.

// ---- Minimal Web Speech API typings (not shipped in lib.dom) -----------------

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

// ---- Public API --------------------------------------------------------------

export type SpeechErrorKind = 'not-allowed' | 'unsupported' | 'other'

export interface SpeechHandlers {
  /** A newly finalized chunk of speech — append it to the transcript. */
  onFinal: (text: string) => void
  /** The current in-progress words — replace the live/interim buffer with this. */
  onInterim: (text: string) => void
  /** A problem worth acting on. 'not-allowed' and 'unsupported' should trigger the fallback. */
  onError: (kind: SpeechErrorKind, message: string) => void
}

export interface SpeechSession {
  stop: () => void
}

const getConstructor = (): SpeechRecognitionConstructor | undefined =>
  typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition ?? window.webkitSpeechRecognition

/** True when this browser can do native speech-to-text (Chrome, Edge, Android Chrome). */
export const isSpeechSupported = (): boolean => getConstructor() !== undefined

/**
 * Start listening. Streams finalized chunks via onFinal and the live interim
 * buffer via onInterim.
 *
 * @returns a session with stop(), or null if recognition could not start (an
 *   'unsupported' or 'other' error will have been reported via handlers.onError).
 */
export const startSpeech = (handlers: SpeechHandlers): SpeechSession | null => {
  const Recognition = getConstructor()
  if (!Recognition) {
    handlers.onError('unsupported', 'Speech recognition is not supported in this browser.')
    return null
  }

  const recognition = new Recognition()
  recognition.lang = 'en-US'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let stopped = false
  let fatal = false

  recognition.onresult = (event: SpeechRecognitionEvent): void => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (!result) continue
      const alternative = result[0]
      if (!alternative) continue
      if (result.isFinal) handlers.onFinal(alternative.transcript)
      else interim += alternative.transcript
    }
    handlers.onInterim(interim)
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      fatal = true
      handlers.onError('not-allowed', 'Microphone access was blocked.')
    } else if (event.error === 'aborted' || event.error === 'no-speech') {
      // 'aborted' is our own stop(); 'no-speech' is a normal pause. Both are noise.
    } else {
      handlers.onError('other', event.message || event.error)
    }
  }

  recognition.onend = (): void => {
    // Session ended (usually a pause). Restart unless we were told to stop or a
    // fatal error (e.g. denied permission) already fired.
    if (stopped || fatal) return
    try {
      recognition.start()
    } catch {
      // start() throws if called too eagerly after end(); safe to ignore.
    }
  }

  try {
    recognition.start()
  } catch (err) {
    handlers.onError('other', err instanceof Error ? err.message : String(err))
    return null
  }

  return {
    stop: (): void => {
      stopped = true
      recognition.stop()
    }
  }
}
